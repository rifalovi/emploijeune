-- =============================================================================
-- Migration 20260615000005 — Refonte du dédoublonnage (A1 & B1)
-- -----------------------------------------------------------------------------
-- Nouvelle règle métier :
--   • A1 (bénéficiaires) : doublon = même COURRIEL ou même TÉLÉPHONE. La simple
--     similarité de nom (sans contact) ne fusionne plus → insertion. Données
--     incomplètes → insertion.
--   • B1 (structures) : doublon = même (nom structure + pays + projet) OU même
--     contact porteur. Le dédoublonnage passe en applicatif pour autoriser un
--     « importer quand même » (insertion forcée des doublons, traitement manuel
--     ultérieur). L'index UNIQUE est donc remplacé par un index simple (lookup).
--
-- Les contraintes UNIQUE basées sur le NOM sont retirées (elles bloquaient les
-- insertions voulues par la nouvelle règle). Le dédoublonnage est désormais géré
-- côté application (avec garde anti re-import 7 jours par hash de fichier).
-- DROP INDEX = sûr (aucune perte de données).
-- =============================================================================

-- A1 — retirer l'unicité nom+date_naissance+projet (la similarité de nom ne
--      doit plus bloquer ; le doublon se juge sur le contact).
DROP INDEX IF EXISTS public.idx_beneficiaires_dedoublonnage;

-- Index de lookup (non unique) pour la détection applicative par contact.
CREATE INDEX IF NOT EXISTS idx_beneficiaires_courriel_lookup
  ON public.beneficiaires (lower(courriel))
  WHERE deleted_at IS NULL AND courriel IS NOT NULL AND courriel <> '';
CREATE INDEX IF NOT EXISTS idx_beneficiaires_telephone_lookup
  ON public.beneficiaires (telephone)
  WHERE deleted_at IS NULL AND telephone IS NOT NULL AND telephone <> '';

-- B1 — remplacer l'index UNIQUE par un index simple (lookup applicatif).
DROP INDEX IF EXISTS public.idx_structures_dedoublonnage;

CREATE INDEX IF NOT EXISTS idx_structures_dedup_lookup
  ON public.structures (lower(public.unaccent_immutable(nom_structure)), pays_code, projet_code)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_structures_courriel_lookup
  ON public.structures (lower(courriel_porteur))
  WHERE deleted_at IS NULL AND courriel_porteur IS NOT NULL AND courriel_porteur <> '';
CREATE INDEX IF NOT EXISTS idx_structures_telephone_lookup
  ON public.structures (telephone_porteur)
  WHERE deleted_at IS NULL AND telephone_porteur IS NOT NULL AND telephone_porteur <> '';
