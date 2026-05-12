-- =============================================================================
-- Migration — Sessions d'import avec rollback (annulation en masse)
-- -----------------------------------------------------------------------------
-- Ajoute une table `import_sessions` pour :
--   1. Regrouper les bénéficiaires importés par session (tag import_session_id)
--   2. Permettre le rollback : soft-delete de toute une session en une action
--   3. Détecter les re-imports : hash SHA-256 du fichier
--
-- Stratégie soft-delete : `deleted_at` sur beneficiaires (déjà existant,
-- cf. migration 20260424000003_soft_delete_metadata.sql).
--
-- Rollback autorisé pendant 30 jours après la session (`rollback_expire_at`).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table import_sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.import_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fichier_nom         TEXT NOT NULL,
  fichier_hash        TEXT,               -- SHA-256 pour détecter re-import
  projet_code         TEXT,               -- projet principal (peut être NULL si multi-projets)
  nb_inserees         INTEGER NOT NULL DEFAULT 0,
  nb_enrichies        INTEGER NOT NULL DEFAULT 0,
  nb_incompletes      INTEGER NOT NULL DEFAULT 0,
  nb_doublons         INTEGER NOT NULL DEFAULT 0,
  nb_rejetees         INTEGER NOT NULL DEFAULT 0,
  statut              TEXT NOT NULL DEFAULT 'en_cours'
                      CHECK (statut IN ('en_cours', 'complete', 'annule', 'erreur')),
  peut_rollback       BOOLEAN NOT NULL DEFAULT true,
  rollback_expire_at  TIMESTAMPTZ,        -- 30 jours après created_at
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.import_sessions IS
  'Sessions d''import en masse de bénéficiaires. Permet le rollback (annulation) jusqu''à rollback_expire_at.';

COMMENT ON COLUMN public.import_sessions.fichier_hash IS
  'SHA-256 du fichier importé (hex). Permet de détecter un re-import du même fichier.';

COMMENT ON COLUMN public.import_sessions.rollback_expire_at IS
  'Date limite pour le rollback (30 jours après created_at). NULL = rollback désactivé.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Lien beneficiaires → import_session
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS import_session_id UUID
  REFERENCES public.import_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_beneficiaires_import_session_id
  ON public.beneficiaires(import_session_id)
  WHERE import_session_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS sur import_sessions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

-- Lecture : super_admin voit tout ; les autres voient leurs propres sessions
CREATE POLICY import_sessions_select ON public.import_sessions
  FOR SELECT TO authenticated
  USING (
    public.current_role_metier() = 'super_admin'
    OR created_by = auth.uid()
    OR public.is_admin_scs()
  );

-- Insertion : les rôles autorisés à importer
CREATE POLICY import_sessions_insert ON public.import_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() IN ('super_admin', 'editeur_projet')
  );

-- Mise à jour : uniquement par le créateur ou admin
CREATE POLICY import_sessions_update ON public.import_sessions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_scs()
    OR public.current_role_metier() = 'super_admin'
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() = 'super_admin'
    OR created_by = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Droits
-- ─────────────────────────────────────────────────────────────────────────────

GRANT ALL ON public.import_sessions TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
