-- =============================================================================
-- Migration 20260616000003 — Retirer l'unicité résiduelle sur cle_identite (A1)
-- -----------------------------------------------------------------------------
-- La refonte du dédoublonnage (migration 20260615000005) avait retiré
-- `idx_beneficiaires_dedoublonnage`, mais un second index UNIQUE subsistait :
-- `uq_beneficiaires_identite_v2` sur `cle_identite`. Il rejetait encore en
-- 23505 les insertions « forcées » de doublons (bouton « Importer quand même »),
-- recomptées à tort comme doublons.
--
-- On le remplace par un index de recherche NON unique (utilisé par la console
-- doublons : detecter_doublons_v1 / fusionner_doublons_v1 groupent par
-- cle_identite). Le dédoublonnage reste géré côté application (par contact).
-- DROP INDEX = sûr (aucune perte de données).
-- =============================================================================

DROP INDEX IF EXISTS public.uq_beneficiaires_identite_v2;

CREATE INDEX IF NOT EXISTS idx_beneficiaires_cle_identite_lookup
  ON public.beneficiaires (cle_identite)
  WHERE deleted_at IS NULL AND cle_identite IS NOT NULL;
