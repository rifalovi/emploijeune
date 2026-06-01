-- =============================================================================
-- Migration 20260602000001 — Phase 9 : formulaire de collecte unifie (Type 0)
-- -----------------------------------------------------------------------------
-- Pourquoi : le Type 0 permet au repondant de choisir sa categorie
--   (beneficiaire / structure / acteur institutionnel) dans un seul
--   formulaire au lieu de devoir connaitre le bon lien A, B, C ou D.
--   Decision validee par VIGNON le 01/06/2026.
--
-- Les 4 types existants (A, B, C, D) coexistent definitivement avec 0.
-- =============================================================================

-- Etendre les CHECK pour accepter '0'
ALTER TABLE public.liens_collecte_publique
  DROP CONSTRAINT IF EXISTS liens_collecte_publique_type_check;
ALTER TABLE public.liens_collecte_publique
  ADD CONSTRAINT liens_collecte_publique_type_check
  CHECK (type IN ('0', 'A', 'B', 'C', 'D'));

ALTER TABLE public.soumissions_collecte
  DROP CONSTRAINT IF EXISTS soumissions_collecte_type_check;
ALTER TABLE public.soumissions_collecte
  ADD CONSTRAINT soumissions_collecte_type_check
  CHECK (type IN ('0', 'A', 'B', 'C', 'D'));

-- Colonne optionnelle pour stocker la categorie choisie par le repondant
-- (facilite les requetes analytiques sans inferer depuis le payload)
ALTER TABLE public.soumissions_collecte
  ADD COLUMN IF NOT EXISTS categorie_repondant TEXT;

COMMENT ON COLUMN public.soumissions_collecte.categorie_repondant IS
  'Categorie choisie par le repondant dans le formulaire Type 0 : beneficiaire, structure, ou acteur_institutionnel. NULL pour les types A/B/C/D.';
