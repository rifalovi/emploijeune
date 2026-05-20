-- =============================================================================
-- Migration — Documents publics téléchargeables (note de cadrage, etc.)
-- -----------------------------------------------------------------------------
-- Permet au super_admin d'uploader des PDF (et autres documents) depuis le
-- back-office, sans déploiement et sans toucher au repo Git. Stockage dans
-- Supabase Storage (bucket public), métadonnées en BDD.
--
-- Premier usage : brief 2.2 — bouton "Télécharger la note de cadrage" sur
-- /referentiels. Architecture prévue pour accueillir d'autres documents
-- publics ensuite (rapports, plaquettes, etc.) avec une simple ligne de
-- plus dans la table.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket Storage : documents-publics
-- ─────────────────────────────────────────────────────────────────────────────
-- Public = TRUE → les fichiers sont accessibles sans signed URL via :
--   https://{project}.supabase.co/storage/v1/object/public/documents-publics/{path}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents-publics',
  'documents-publics',
  TRUE,
  20971520,                              -- 20 Mo max par fichier
  ARRAY['application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Storage : lecture publique, écriture super_admin uniquement
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS documents_publics_storage_read ON storage.objects;
CREATE POLICY documents_publics_storage_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents-publics');

DROP POLICY IF EXISTS documents_publics_storage_insert ON storage.objects;
CREATE POLICY documents_publics_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents-publics' AND public.is_super_admin());

DROP POLICY IF EXISTS documents_publics_storage_update ON storage.objects;
CREATE POLICY documents_publics_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents-publics' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'documents-publics' AND public.is_super_admin());

DROP POLICY IF EXISTS documents_publics_storage_delete ON storage.objects;
CREATE POLICY documents_publics_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents-publics' AND public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Table de métadonnées
-- ─────────────────────────────────────────────────────────────────────────────
-- Une ligne par "slot" de document public. La clé est un identifiant
-- sémantique stable (ex. 'note_cadrage') qui sert d'ancrage côté front.

CREATE TABLE IF NOT EXISTS public.documents_publics (
  cle              TEXT PRIMARY KEY,
  libelle          TEXT NOT NULL,
  nom_fichier      TEXT NOT NULL,
  chemin_storage   TEXT NOT NULL,
  url_publique     TEXT NOT NULL,
  taille_octets    INTEGER NOT NULL,
  content_type     TEXT NOT NULL DEFAULT 'application/pdf',
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.documents_publics IS
  'Métadonnées des documents PDF publics téléchargeables (note de cadrage, etc.). Le fichier est stocké dans le bucket documents-publics. Écriture super_admin uniquement.';

-- Pré-remplissage : une ligne de réservation pour la note de cadrage.
-- Tant qu'aucun upload n'a eu lieu, url_publique est vide → le front cache le bouton.
INSERT INTO public.documents_publics
  (cle, libelle, nom_fichier, chemin_storage, url_publique, taille_octets)
VALUES
  ('note_cadrage', 'Note de cadrage OIF', '', '', '', 0)
ON CONFLICT (cle) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : lecture publique, écriture super_admin
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documents_publics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_publics_lecture ON public.documents_publics;
CREATE POLICY documents_publics_lecture
  ON public.documents_publics FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS documents_publics_ecriture_super_admin ON public.documents_publics;
CREATE POLICY documents_publics_ecriture_super_admin
  ON public.documents_publics FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT ON public.documents_publics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.documents_publics TO authenticated;
