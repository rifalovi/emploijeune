-- =============================================================================
-- Migration — Historique des traitements SCS DataStudio
-- -----------------------------------------------------------------------------
-- Étape 3 de l'intégration en ligne de SCS DataStudio (scénario B). La version
-- en ligne, contrairement au bureau, conserve l'historique des traitements
-- (tris à plat, croisements, tableaux de fréquences, tests, rapports) dans
-- Supabase, ainsi que les fichiers générés (Excel/.sav/Word) dans Storage.
--
-- Modèle de données :
--   • datastudio_jobs       : un traitement (paramètres, source, statut)
--   • datastudio_results    : le résultat sérialisé d'un traitement (JSONB)
--   • datastudio_artifacts  : les fichiers exportés, stockés dans le bucket
--                             privé « datastudio »
--
-- Périmètre d'accès (RLS) : chaque utilisateur ne voit que SON historique ;
-- admin_scs / super_admin voient tout (via public.is_admin_scs()). Le
-- rattachement projet (projet_code) est conservé pour permettre, plus tard,
-- une visibilité par projet sans changer le modèle.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Types
-- ─────────────────────────────────────────────────────────────────────────────

-- Nature du traitement enregistré.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'datastudio_job_type') THEN
    CREATE TYPE public.datastudio_job_type AS ENUM (
      'frequency',   -- tri à plat / tableau de fréquences
      'crosstab',    -- croisement / panel
      'multi',       -- questions à réponses multiples
      'stat_test',   -- Khi² / t-test
      'cleaning',    -- épuration
      'report',      -- rapport structuré (API Claude)
      'export'       -- export de fichier (Excel/.sav/Word)
    );
  END IF;
END$$;

-- Statut d'exécution du traitement.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'datastudio_job_statut') THEN
    CREATE TYPE public.datastudio_job_statut AS ENUM (
      'en_cours',
      'termine',
      'echec'
    );
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table datastudio_jobs — un traitement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.datastudio_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Propriétaire du traitement (l'utilisateur qui l'a lancé).
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Scoping optionnel : organisation et projet du traitement.
  organisation_id UUID REFERENCES public.organisations(id),
  projet_code TEXT REFERENCES public.projets(code),
  -- Provenance des données : 'enquete' (module Enquête), 'upload' (fichier
  -- importé : Kobo / CSPro / .sav), 'connexe', etc.
  source TEXT NOT NULL DEFAULT 'upload',
  -- Référence lisible de la source (indicateur_code, nom de fichier, vague...).
  source_ref TEXT,
  type public.datastudio_job_type NOT NULL,
  titre TEXT NOT NULL,
  -- Paramètres du traitement (variables analysées, options, sens du %, ...).
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  statut public.datastudio_job_statut NOT NULL DEFAULT 'termine',
  -- Message d'erreur ou d'information éventuel.
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_datastudio_jobs_user
  ON public.datastudio_jobs(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_datastudio_jobs_projet
  ON public.datastudio_jobs(projet_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_datastudio_jobs_type
  ON public.datastudio_jobs(type, created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.datastudio_jobs IS
  'Historique des traitements SCS DataStudio (un par tri à plat / croisement / rapport...).';

CREATE TRIGGER trg_datastudio_jobs_upd
  BEFORE UPDATE ON public.datastudio_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table datastudio_results — résultat sérialisé d'un traitement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.datastudio_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.datastudio_jobs(id) ON DELETE CASCADE,
  -- Résultat structuré : tables de fréquences, croisements, stats, etc.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Aperçu / synthèse textuelle (pour affichage rapide de l'historique).
  apercu TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datastudio_results_job
  ON public.datastudio_results(job_id);

COMMENT ON TABLE public.datastudio_results IS
  'Résultats calculés d''un traitement DataStudio (JSONB relu par le module Atelier).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Table datastudio_artifacts — fichiers générés (Storage)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.datastudio_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.datastudio_jobs(id) ON DELETE CASCADE,
  -- Chemin de l'objet dans le bucket « datastudio » : {user_id}/{job_id}/{fichier}.
  bucket_path TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  type_mime TEXT,
  taille_octets BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datastudio_artifacts_job
  ON public.datastudio_artifacts(job_id);

COMMENT ON TABLE public.datastudio_artifacts IS
  'Fichiers exportés d''un traitement DataStudio (Excel/.sav/Word), stockés dans le bucket privé datastudio.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — chaque utilisateur son historique ; admin_scs voit tout
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.datastudio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datastudio_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datastudio_artifacts ENABLE ROW LEVEL SECURITY;

-- Jobs : le propriétaire gère les siens ; admin_scs a tout accès.
DROP POLICY IF EXISTS datastudio_jobs_owner ON public.datastudio_jobs;
CREATE POLICY datastudio_jobs_owner ON public.datastudio_jobs
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_scs())
  WITH CHECK (user_id = auth.uid() OR public.is_admin_scs());

-- Résultats : accès calqué sur le job parent.
DROP POLICY IF EXISTS datastudio_results_via_job ON public.datastudio_results;
CREATE POLICY datastudio_results_via_job ON public.datastudio_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.datastudio_jobs j
      WHERE j.id = datastudio_results.job_id
        AND (j.user_id = auth.uid() OR public.is_admin_scs())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datastudio_jobs j
      WHERE j.id = datastudio_results.job_id
        AND (j.user_id = auth.uid() OR public.is_admin_scs())
    )
  );

-- Artifacts : accès calqué sur le job parent.
DROP POLICY IF EXISTS datastudio_artifacts_via_job ON public.datastudio_artifacts;
CREATE POLICY datastudio_artifacts_via_job ON public.datastudio_artifacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.datastudio_jobs j
      WHERE j.id = datastudio_artifacts.job_id
        AND (j.user_id = auth.uid() OR public.is_admin_scs())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datastudio_jobs j
      WHERE j.id = datastudio_artifacts.job_id
        AND (j.user_id = auth.uid() OR public.is_admin_scs())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Bucket Storage privé « datastudio »
-- ─────────────────────────────────────────────────────────────────────────────
-- Privé (public = FALSE) : les fichiers ne sont accessibles que par URL signée.
-- 50 Mo par fichier (les .sav de production ne dépassent pas ~25 Mo ; marge pour
-- les exports Excel/Word). Convention de chemin : {user_id}/{job_id}/{fichier}.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datastudio',
  'datastudio',
  FALSE,
  52428800,                              -- 50 Mo max par fichier
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'text/csv',
    'application/pdf',
    'application/octet-stream',          -- .sav (pas de type MIME standard)
    'application/x-spss-sav'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Storage : le propriétaire (premier segment du chemin = son user_id) gère
-- ses fichiers ; admin_scs peut tout lire.
DROP POLICY IF EXISTS datastudio_storage_read ON storage.objects;
CREATE POLICY datastudio_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'datastudio'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_scs()
    )
  );

DROP POLICY IF EXISTS datastudio_storage_insert ON storage.objects;
CREATE POLICY datastudio_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'datastudio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS datastudio_storage_update ON storage.objects;
CREATE POLICY datastudio_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'datastudio'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_scs())
  )
  WITH CHECK (
    bucket_id = 'datastudio'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_scs())
  );

DROP POLICY IF EXISTS datastudio_storage_delete ON storage.objects;
CREATE POLICY datastudio_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'datastudio'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_scs())
  );
