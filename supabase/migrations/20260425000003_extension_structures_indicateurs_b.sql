-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 011 :
-- Extension table structures pour exposer les champs Section 5/6/7 du
-- formulaire création (Étape 5c)
-- -----------------------------------------------------------------------------
-- Brief Étape 5c (Carlos, 25/04/2026) demande 7 champs additionnels que la
-- table `structures` ne possède pas en version initiale (migration 001) :
--
--   Section 5 — Détails du porteur :
--     - fonction_porteur (TEXT) : rôle/fonction du porteur (fondateur, gérant…)
--
--   Section 6 — Géolocalisation :
--     - adresse (TEXT) : adresse postale détaillée (en complément de localite)
--     - ville (TEXT) : ville (en complément de localite)
--
--   Section 7 — Informations complémentaires (alimente indicateurs B Cadre Commun) :
--     - chiffre_affaires (NUMERIC 14,2) : CA annuel déclaré
--     - employes_permanents (SMALLINT ≥ 0) : effectif permanent
--     - employes_temporaires (SMALLINT ≥ 0) : effectif temporaire
--     - emplois_crees (SMALLINT ≥ 0) : nombre d'emplois créés grâce à l'appui
--
-- Tous les champs sont OPTIONNELS (NULL autorisé) — on n'impose rien aux
-- partenaires terrain qui ne disposeraient pas de ces données.
--
-- Ces colonnes alimenteront l'indicateur B « Activités Économiques » du
-- dashboard Étape 9 (cf. retour N+1 André, 24/04/2026). On les ajoute dès
-- maintenant pour éviter une migration tardive lorsque les dashboards
-- seront codés.
--
-- ⚠️ Pas de breaking change : aucune colonne renommée/supprimée. Les
-- requêtes existantes (queries.ts, export-helpers.ts) continuent à
-- fonctionner sans modification.
-- =============================================================================

ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS fonction_porteur TEXT,
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS chiffre_affaires NUMERIC(14, 2)
    CHECK (chiffre_affaires IS NULL OR chiffre_affaires >= 0),
  ADD COLUMN IF NOT EXISTS employes_permanents SMALLINT
    CHECK (employes_permanents IS NULL OR employes_permanents >= 0),
  ADD COLUMN IF NOT EXISTS employes_temporaires SMALLINT
    CHECK (employes_temporaires IS NULL OR employes_temporaires >= 0),
  ADD COLUMN IF NOT EXISTS emplois_crees SMALLINT
    CHECK (emplois_crees IS NULL OR emplois_crees >= 0);

COMMENT ON COLUMN public.structures.fonction_porteur IS
  'Fonction du porteur dans la structure (fondateur, gérant, président, etc.). Optionnel.';
COMMENT ON COLUMN public.structures.adresse IS
  'Adresse postale détaillée du siège (rue, numéro). Complémentaire de localite. Optionnel.';
COMMENT ON COLUMN public.structures.ville IS
  'Ville du siège (si différente ou plus précise que localite). Optionnel.';
COMMENT ON COLUMN public.structures.chiffre_affaires IS
  'Chiffre d''affaires annuel déclaré, dans la devise de la structure (généralement devise_code de l''appui). Indicateur B (Activités Économiques).';
COMMENT ON COLUMN public.structures.employes_permanents IS
  'Effectif permanent à l''instant t. Indicateur B (emplois directs).';
COMMENT ON COLUMN public.structures.employes_temporaires IS
  'Effectif temporaire/saisonnier à l''instant t. Indicateur B (emplois directs).';
COMMENT ON COLUMN public.structures.emplois_crees IS
  'Nombre d''emplois nouvellement créés grâce à l''appui OIF (cumul). Indicateur B clé pour le dashboard.';
