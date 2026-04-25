-- =============================================================================
-- Étape 6a — Sessions d'enquête (regroupement N indicateurs / 1 soumission)
-- -----------------------------------------------------------------------------
-- Une soumission de questionnaire (A ou B) produit N lignes
-- `reponses_enquetes` (1 par indicateur calculé : A2, A3, A4, A5, F1, C5
-- pour le questionnaire A ; B2, B3, B4, C5 pour le questionnaire B).
-- Toutes les lignes issues d'une même soumission partagent le même
-- `session_enquete_id` (UUID généré côté client à la soumission).
--
-- Permet :
--   * Affichage groupé d'une session dans /enquetes/[session_id]
--   * Soft-delete groupé (re-saisie complète d'une session)
--   * Audit : retrouver toutes les réponses d'une session via INDEX
-- =============================================================================

ALTER TABLE public.reponses_enquetes
  ADD COLUMN session_enquete_id UUID;

CREATE INDEX idx_reponses_session
  ON public.reponses_enquetes(session_enquete_id)
  WHERE session_enquete_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.reponses_enquetes.session_enquete_id IS
  'UUID partagé par toutes les lignes issues d''une même soumission de questionnaire (Étape 6a). NULL pour les lignes historiques importées hors session (Étape 7).';
