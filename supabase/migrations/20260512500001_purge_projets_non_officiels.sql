-- =============================================================================
-- Migration : Purge des projets non officiels + blindage du référentiel
-- =============================================================================
-- Contexte : des entrées de test ont été insérées directement dans la table
-- `projets` via Supabase Studio (ex. "nouveau projet emploi jeunesse"), sans
-- passer par le seed officiel. Ces codes non conformes apparaissent dans les
-- dropdowns et badges de la plateforme.
--
-- Cette migration :
--   1. Retire les affectations orphelines référençant des codes non officiels
--   2. Retire les liaisons beneficiaires/structures orphelines
--   3. Supprime les lignes projets non conformes
--   4. Ajoute un CHECK constraint pour empêcher toute future insertion hors
--      nomenclature officielle OIF (format PROJ_A[0-9]{1,2}[a-z]?)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nettoyage des affectations orphelines
-- ─────────────────────────────────────────────────────────────────────────────

-- Historique des affectations utilisateur
DELETE FROM public.affectation_projet_historique
WHERE projet_code NOT IN (SELECT code FROM public.projets WHERE code ~ '^PROJ_A[0-9]+[a-z]?$');

-- Affectations courantes utilisateur
DELETE FROM public.affectation_projet_courante
WHERE projet_code NOT IN (SELECT code FROM public.projets WHERE code ~ '^PROJ_A[0-9]+[a-z]?$');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Nettoyage des liaisons structures orphelines
-- ─────────────────────────────────────────────────────────────────────────────

-- Historique des projets de financement des structures
DELETE FROM public.structure_projet_historique
WHERE projet_code NOT IN (SELECT code FROM public.projets WHERE code ~ '^PROJ_A[0-9]+[a-z]?$');

-- Structures avec projet_code orphelin (reset vers NULL si la colonne est nullable)
UPDATE public.structures
SET projet_code = NULL
WHERE projet_code IS NOT NULL
  AND projet_code NOT IN (SELECT code FROM public.projets WHERE code ~ '^PROJ_A[0-9]+[a-z]?$');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Nettoyage des bénéficiaires orphelins
-- ─────────────────────────────────────────────────────────────────────────────

-- Bénéficiaires avec projet_code orphelin (reset vers NULL si nullable)
UPDATE public.beneficiaires
SET projet_code = NULL
WHERE projet_code IS NOT NULL
  AND projet_code NOT IN (SELECT code FROM public.projets WHERE code ~ '^PROJ_A[0-9]+[a-z]?$');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Suppression des projets non officiels
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.projets
WHERE code NOT IN (
  -- Liste exhaustive des 23 codes officiels OIF
  'PROJ_A01a', 'PROJ_A01b', 'PROJ_A01c',
  'PROJ_A02', 'PROJ_A03', 'PROJ_A04', 'PROJ_A05',
  'PROJ_A06', 'PROJ_A07', 'PROJ_A08', 'PROJ_A09',
  'PROJ_A10', 'PROJ_A11', 'PROJ_A12', 'PROJ_A13',
  'PROJ_A14', 'PROJ_A15', 'PROJ_A16a', 'PROJ_A16b',
  'PROJ_A17', 'PROJ_A18', 'PROJ_A19', 'PROJ_A20'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CHECK constraint sur projets.code (blindage futur)
-- ─────────────────────────────────────────────────────────────────────────────
-- Empêche l'insertion directe (Studio, script) d'un code ne respectant pas
-- le format officiel OIF : PROJ_A suivi de 1-2 chiffres, optionnellement
-- une lettre minuscule (ex. PROJ_A01a, PROJ_A16b, PROJ_A17).

ALTER TABLE public.projets
  DROP CONSTRAINT IF EXISTS projets_code_format_check;

ALTER TABLE public.projets
  ADD CONSTRAINT projets_code_format_check
  CHECK (code ~ '^PROJ_A[0-9]{1,2}[a-z]?$');

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification (trace dans les logs de migration)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  nb_projets INT;
BEGIN
  SELECT COUNT(*) INTO nb_projets FROM public.projets;
  RAISE NOTICE 'Purge terminée — projets officiels restants : %', nb_projets;
  IF nb_projets <> 23 THEN
    RAISE WARNING 'Nombre inattendu de projets (attendu 23, obtenu %). Vérifier le seed.', nb_projets;
  END IF;
END $$;
