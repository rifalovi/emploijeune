-- =============================================================================
-- Liens de collecte publique -- ajout du type C
-- -----------------------------------------------------------------------------
-- Elargit les CHECK constraints sur liens_collecte_publique.type et
-- soumissions_collecte.type pour accepter 'C' (Questionnaire intermediation
-- vers l'emploi). Type C cible des beneficiaires, comme A.
-- =============================================================================

ALTER TABLE public.liens_collecte_publique
  DROP CONSTRAINT IF EXISTS liens_collecte_publique_type_check;

ALTER TABLE public.liens_collecte_publique
  ADD CONSTRAINT liens_collecte_publique_type_check
  CHECK (type IN ('A', 'B', 'C'));

ALTER TABLE public.soumissions_collecte
  DROP CONSTRAINT IF EXISTS soumissions_collecte_type_check;

ALTER TABLE public.soumissions_collecte
  ADD CONSTRAINT soumissions_collecte_type_check
  CHECK (type IN ('A', 'B', 'C'));
