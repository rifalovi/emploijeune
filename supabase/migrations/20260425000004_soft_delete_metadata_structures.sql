-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 012 :
-- Métadonnées soft-delete pour les structures (équivalent migration 008 A1)
-- -----------------------------------------------------------------------------
-- En 008, on avait ajouté `deleted_by` + `deleted_reason` sur `beneficiaires`
-- pour tracer QUI a supprimé QUOI et POURQUOI. On fait la même chose pour
-- `structures` afin que la suppression admin_scs (Étape 5d) puisse tracer
-- l'auteur et la raison métier.
--
-- Le journal d'audit (`journaux_audit`) capture déjà l'opération
-- 'SOFT_DELETE' via le trigger `trg_structures_audit` (migration 001).
-- Cette migration ajoute uniquement les colonnes au sens « source de vérité
-- métier » sur la fiche elle-même, ce qui simplifie l'affichage du bandeau
-- de suppression dans la fiche détail.
-- =============================================================================

ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

COMMENT ON COLUMN public.structures.deleted_by IS
  'Utilisateur ayant déclenché la suppression logique (admin_scs uniquement, vérifié côté Server Action).';
COMMENT ON COLUMN public.structures.deleted_reason IS
  'Raison optionnelle saisie par l''admin au moment de la suppression. Conservée pour justifier l''action auprès du partenaire ou du SCS.';
