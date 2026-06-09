-- =============================================================================
-- Migration 20260609000002 — Fix : ajouter 'annule_admin' au check constraint
-- -----------------------------------------------------------------------------
-- La fonction annuler_session_import_v1 utilisait statut = 'annule_admin'
-- mais le constraint n'autorisait que ('en_cours','complete','annule','erreur').
-- =============================================================================

ALTER TABLE public.import_sessions
  DROP CONSTRAINT IF EXISTS import_sessions_statut_check;

ALTER TABLE public.import_sessions
  ADD CONSTRAINT import_sessions_statut_check
  CHECK (statut IN ('en_cours', 'complete', 'annule', 'annule_admin', 'erreur'));
