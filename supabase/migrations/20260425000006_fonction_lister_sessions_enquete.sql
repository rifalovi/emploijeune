-- =============================================================================
-- Étape 6c — Fonction de listing des sessions d'enquête (paginée + filtrée)
-- -----------------------------------------------------------------------------
-- Une session = N lignes `reponses_enquetes` partageant le même
-- `session_enquete_id` (cf. migration 005). Cette fonction agrège ces lignes
-- pour produire 1 ligne par session avec :
--   * Métadonnées de la session (cible, questionnaire, projet, vague, canal,
--     date de collecte, dates techniques, créateur)
--   * Nombre d'indicateurs collectés
--   * Liste triée des codes d'indicateurs (ARRAY_AGG)
--   * Total count agrégé (CROSS JOIN counted) — évite un 2e appel pour
--     calculer le total de la pagination
--
-- Sécurité : SECURITY INVOKER → la RLS de `reponses_enquetes` (migration 002)
-- s'applique naturellement. Un `contributeur_partenaire` ne voit que ses
-- propres sessions ou celles dans son périmètre (helpers can_read_*).
--
-- Performance : pour 60 partenaires × ~50 sessions × ~6 indicateurs
-- (~18 000 lignes), réponse < 100 ms grâce aux index existants
-- (idx_reponses_session, idx_reponses_beneficiaire, idx_reponses_structure).
--
-- Note hotfix 6h (26/04/2026) : PostgreSQL ne fournit PAS d'agrégats MIN/MAX
-- sur le type UUID natif. Pour agréger UUID dans une session (où toutes les
-- lignes partagent la même valeur par construction de soumettreEnquete), on
-- caste en TEXT puis on re-caste en UUID. Pour les booléens d'inférence du
-- questionnaire, on utilise BOOL_OR (qui supporte tous les types).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lister_sessions_enquete(
  p_questionnaire TEXT DEFAULT NULL,
  p_projet_code TEXT DEFAULT NULL,
  p_cible_id UUID DEFAULT NULL,
  p_vague_enquete TEXT DEFAULT NULL,
  p_canal_collecte TEXT DEFAULT NULL,
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_recherche TEXT DEFAULT NULL,
  p_mien_uid UUID DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  beneficiaire_id UUID,
  structure_id UUID,
  cible_libelle TEXT,
  questionnaire TEXT,
  projet_code TEXT,
  programme_strategique TEXT,
  vague_enquete TEXT,
  canal_collecte TEXT,
  date_collecte DATE,
  nb_indicateurs INTEGER,
  indicateurs TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  total_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
WITH sessions AS (
  SELECT
    re.session_enquete_id AS id,
    -- UUID : pas d'agrégat natif PG ; toutes les lignes d'une session
    -- partagent la même valeur (construction soumettreEnquete) → cast text
    MIN(re.beneficiaire_id::text)::uuid AS beneficiaire_id,
    MIN(re.structure_id::text)::uuid AS structure_id,
    -- Libellé cible : « Prénom NOM » (bénéficiaire) ou nom structure
    COALESCE(
      MAX(b.prenom || ' ' || b.nom),
      MAX(s.nom_structure)
    ) AS cible_libelle,
    -- Inférence du questionnaire : BOOL_OR (compatible tous types)
    CASE
      WHEN BOOL_OR(re.beneficiaire_id IS NOT NULL) THEN 'A'
      WHEN BOOL_OR(re.structure_id IS NOT NULL) THEN 'B'
      ELSE NULL
    END AS questionnaire,
    -- Le projet_code est sur reponses_enquetes (D1-D3) OU dérivé de la cible
    COALESCE(MIN(re.projet_code), MIN(b.projet_code), MIN(s.projet_code)) AS projet_code,
    MIN(p.programme_strategique) AS programme_strategique,
    MIN(re.vague_enquete::text) AS vague_enquete,
    MIN(re.canal_collecte::text) AS canal_collecte,
    MIN(re.date_collecte) AS date_collecte,
    COUNT(*)::INT AS nb_indicateurs,
    ARRAY_AGG(re.indicateur_code ORDER BY re.indicateur_code) AS indicateurs,
    MIN(re.created_at) AS created_at,
    MAX(re.updated_at) AS updated_at,
    MIN(re.created_by::text)::uuid AS created_by
  FROM public.reponses_enquetes re
  LEFT JOIN public.beneficiaires b ON re.beneficiaire_id = b.id
  LEFT JOIN public.structures s ON re.structure_id = s.id
  LEFT JOIN public.projets p ON p.code = COALESCE(re.projet_code, b.projet_code, s.projet_code)
  WHERE re.deleted_at IS NULL
    AND re.session_enquete_id IS NOT NULL
  GROUP BY re.session_enquete_id
),
filtered AS (
  SELECT * FROM sessions
  WHERE
    (p_questionnaire IS NULL OR sessions.questionnaire = p_questionnaire) AND
    (p_projet_code IS NULL OR sessions.projet_code = p_projet_code) AND
    (
      p_cible_id IS NULL
      OR sessions.beneficiaire_id = p_cible_id
      OR sessions.structure_id = p_cible_id
    ) AND
    (p_vague_enquete IS NULL OR sessions.vague_enquete = p_vague_enquete) AND
    (p_canal_collecte IS NULL OR sessions.canal_collecte = p_canal_collecte) AND
    (p_date_debut IS NULL OR sessions.date_collecte >= p_date_debut) AND
    (p_date_fin IS NULL OR sessions.date_collecte <= p_date_fin) AND
    (
      p_recherche IS NULL
      OR sessions.cible_libelle ILIKE '%' || p_recherche || '%'
    ) AND
    (p_mien_uid IS NULL OR sessions.created_by = p_mien_uid)
),
counted AS (
  SELECT COUNT(*)::BIGINT AS total_count FROM filtered
)
SELECT
  f.id, f.beneficiaire_id, f.structure_id, f.cible_libelle,
  f.questionnaire, f.projet_code, f.programme_strategique,
  f.vague_enquete, f.canal_collecte, f.date_collecte,
  f.nb_indicateurs, f.indicateurs,
  f.created_at, f.updated_at, f.created_by,
  c.total_count
FROM filtered f
CROSS JOIN counted c
ORDER BY f.updated_at DESC
LIMIT p_limit OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.lister_sessions_enquete IS
  'Liste paginée et filtrée des sessions d''enquête. Retourne 1 ligne par session_enquete_id avec la liste agrégée des indicateurs collectés et le total_count global pour pagination. Étape 6c.';
