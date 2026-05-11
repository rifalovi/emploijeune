-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 027
-- Ajout de tranche_age_declaree dans lister_sessions_enquete
-- -----------------------------------------------------------------------------
-- La liste des sessions d'enquête (questionnaire A) affiche maintenant
-- la tranche d'âge déclarée du bénéficiaire, alignée sur les campagnes.
--
-- La fonction SQL joint déjà `public.beneficiaires` (pour cible_libelle) ;
-- on ajoute simplement MAX(b.tranche_age_declaree) dans le CTE `sessions`.
--
-- Le RETURNS TABLE change → DROP IF EXISTS requis avant CREATE OR REPLACE.
-- =============================================================================

DROP FUNCTION IF EXISTS public.lister_sessions_enquete(
  TEXT, TEXT, UUID, TEXT, TEXT, DATE, DATE, TEXT, UUID, INT, INT
);

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
  tranche_age_declaree TEXT,
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
    MIN(re.beneficiaire_id::text)::uuid AS beneficiaire_id,
    MIN(re.structure_id::text)::uuid AS structure_id,
    COALESCE(
      MAX(b.prenom || ' ' || b.nom),
      MAX(s.nom_structure)
    ) AS cible_libelle,
    CASE
      WHEN BOOL_OR(re.beneficiaire_id IS NOT NULL) THEN 'A'
      WHEN BOOL_OR(re.structure_id IS NOT NULL) THEN 'B'
      ELSE NULL
    END AS questionnaire,
    COALESCE(MIN(re.projet_code), MIN(b.projet_code), MIN(s.projet_code)) AS projet_code,
    MIN(p.programme_strategique) AS programme_strategique,
    MIN(re.vague_enquete::text) AS vague_enquete,
    MIN(re.canal_collecte::text) AS canal_collecte,
    MIN(re.date_collecte) AS date_collecte,
    COUNT(*)::INT AS nb_indicateurs,
    ARRAY_AGG(re.indicateur_code ORDER BY re.indicateur_code) AS indicateurs,
    -- Tranche d'âge déclarée OIF : uniquement pour les bénéficiaires (questionnaire A)
    -- NULL pour les structures (questionnaire B)
    MAX(b.tranche_age_declaree) AS tranche_age_declaree,
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
  f.tranche_age_declaree,
  f.created_at, f.updated_at, f.created_by,
  c.total_count
FROM filtered f
CROSS JOIN counted c
ORDER BY f.updated_at DESC
LIMIT p_limit OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.lister_sessions_enquete IS
  'Liste paginée et filtrée des sessions d''enquête. Retourne 1 ligne par session_enquete_id avec la liste agrégée des indicateurs collectés, la tranche_age_declaree (questionnaire A) et le total_count pour pagination. Mise à jour migration 027.';
