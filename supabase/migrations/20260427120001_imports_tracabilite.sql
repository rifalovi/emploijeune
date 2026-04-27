-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 017 : traçabilité imports
-- -----------------------------------------------------------------------------
-- Sprint 2 — Migration des données réelles (5 618 bénéficiaires + 341
-- structures). Cette migration ajoute les colonnes de traçabilité requises
-- pour identifier les lignes provenant de la base OIF officielle, et permettre
-- un rollback ciblé si nécessaire.
--
-- Colonnes ajoutées sur `beneficiaires` et `structures` :
--   • import_source       — identifiant logique de la source (ex. 'BASE_OIF_230426_V2')
--   • import_batch        — date / nom de la session d'import
--   • import_index        — index ligne dans le fichier source (idempotence)
--   • consentement_origine — 'COLLECTE_INITIALE_OIF' pour les imports OIF
--
-- Index unique partiel `(import_source, import_index)` : permet aux scripts
-- d'import de relancer en mode idempotent (ON CONFLICT DO NOTHING).
--
-- Ajoute aussi les mappings P6 → PROJ_A06 et P13 → PROJ_A13 dans la table
-- `projets_codes_legacy` (manquants en seed.sql alors que les CSV de la base
-- OIF contiennent ces codes).
-- =============================================================================

-- 1. Colonnes de traçabilité — bénéficiaires
ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS import_batch TEXT,
  ADD COLUMN IF NOT EXISTS import_index INTEGER,
  ADD COLUMN IF NOT EXISTS consentement_origine TEXT;

CREATE INDEX IF NOT EXISTS idx_beneficiaires_import_source
  ON public.beneficiaires(import_source)
  WHERE import_source IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_beneficiaires_import_idempotence
  ON public.beneficiaires(import_source, import_index)
  WHERE import_source IS NOT NULL AND import_index IS NOT NULL;

-- 2. Colonnes de traçabilité — structures
ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS import_batch TEXT,
  ADD COLUMN IF NOT EXISTS import_index INTEGER,
  ADD COLUMN IF NOT EXISTS consentement_origine TEXT;

CREATE INDEX IF NOT EXISTS idx_structures_import_source
  ON public.structures(import_source)
  WHERE import_source IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_structures_import_idempotence
  ON public.structures(import_source, import_index)
  WHERE import_source IS NOT NULL AND import_index IS NOT NULL;

-- 3. Compléments mapping legacy P6 + P13 (manquants en seed initial)
INSERT INTO public.projets_codes_legacy(code_legacy, code_officiel) VALUES
  ('P6',  'PROJ_A06'),
  ('P13', 'PROJ_A13')
ON CONFLICT (code_legacy) DO UPDATE SET
  code_officiel = EXCLUDED.code_officiel;

COMMENT ON COLUMN public.beneficiaires.import_source IS
  'Identifiant logique de la source d''import (ex. BASE_OIF_230426_V2). NULL pour saisie manuelle.';
COMMENT ON COLUMN public.beneficiaires.import_batch IS
  'Date ou identifiant de session d''import (ex. 2026-04-27-migration-initiale). Permet rollback ciblé.';
COMMENT ON COLUMN public.beneficiaires.import_index IS
  'Index ligne dans le fichier source — utilisé pour idempotence ON CONFLICT.';
COMMENT ON COLUMN public.beneficiaires.consentement_origine IS
  'Origine du consentement RGPD : COLLECTE_INITIALE_OIF, FORMULAIRE_PUBLIC, SAISIE_MANUELLE.';
