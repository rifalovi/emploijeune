-- =============================================================================
-- Migration 20260609000001 — Fix : ajouter import_session_id sur structures
-- -----------------------------------------------------------------------------
-- La fonction annuler_session_import_v1 referencait structures.import_session_id
-- qui n'existait pas, causant une erreur lors de l'annulation d'un import.
-- =============================================================================

ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS import_session_id UUID
  REFERENCES public.import_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_structures_import_session_id
  ON public.structures(import_session_id)
  WHERE import_session_id IS NOT NULL;
