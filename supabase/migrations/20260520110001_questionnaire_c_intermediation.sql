-- =============================================================================
-- Questionnaire C -- Intermediation vers l'emploi (C1, C2, C4, C5)
-- -----------------------------------------------------------------------------
-- Ce fichier effectue 4 changements coordonnes :
--
--   1. Ajoute la colonne questionnaire_code a reponses_enquetes
--      pour distinguer les sessions C (beneficiaire) des sessions A.
--      Anciennement, le questionnaire etait infere de beneficiaire_id
--      (-> 'A') ou structure_id (-> 'B') ; cette inference est ambigue
--      des qu'un nouveau questionnaire cible les beneficiaires.
--
--   2. Remplit la colonne pour les sessions existantes.
--
--   3. Met a jour la fonction lister_sessions_enquete pour utiliser
--      questionnaire_code en priorite (fallback sur l'inference pour
--      les lignes historiques sans questionnaire_code).
--
--   4. Etend les contraintes CHECK de tokens_enquete_publique pour
--      accepter le questionnaire 'C' (cible : beneficiaires, comme A).
-- =============================================================================

-- ============================================================
-- 1. Colonne questionnaire_code sur reponses_enquetes
-- ============================================================

ALTER TABLE public.reponses_enquetes
  ADD COLUMN IF NOT EXISTS questionnaire_code TEXT;

-- Index partiel pour les lookups par questionnaire
CREATE INDEX IF NOT EXISTS idx_reponses_questionnaire_code
  ON public.reponses_enquetes(questionnaire_code)
  WHERE questionnaire_code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.reponses_enquetes.questionnaire_code IS
  'Code du questionnaire source (A, B, C, D...). Obligatoire pour toutes les lignes issues de soumettreEnquete. NULL pour les lignes historiques importees hors session.';

-- ============================================================
-- 2. Backfill des lignes existantes (sessions A et B anterieures)
-- ============================================================

UPDATE public.reponses_enquetes
SET questionnaire_code = CASE
  WHEN beneficiaire_id IS NOT NULL THEN 'A'
  WHEN structure_id IS NOT NULL THEN 'B'
  ELSE NULL
END
WHERE questionnaire_code IS NULL
  AND session_enquete_id IS NOT NULL;

-- ============================================================
-- 3. Mise a jour de lister_sessions_enquete
--    Utilise questionnaire_code si disponible, sinon inference historique.
-- ============================================================

-- DROP requis car la signature de retour change (ajout du champ questionnaire
-- calcule via questionnaire_code).
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
    -- Questionnaire : colonne explicite en priorite, inference historique en fallback
    COALESCE(
      MIN(re.questionnaire_code),
      CASE
        WHEN BOOL_OR(re.beneficiaire_id IS NOT NULL) THEN 'A'
        WHEN BOOL_OR(re.structure_id IS NOT NULL) THEN 'B'
        ELSE NULL
      END
    ) AS questionnaire,
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
  'Liste paginee et filtree des sessions enquete. Utilise questionnaire_code (C inclus) pour distinguer les sessions de meme cible_type. Etape 6c v2.';

-- ============================================================
-- 4. Contraintes tokens_enquete_publique -- ajout questionnaire C
-- ============================================================

-- Suppression des deux contraintes CHECK existantes qui excluent 'C'
ALTER TABLE public.tokens_enquete_publique
  DROP CONSTRAINT IF EXISTS chk_tokens_questionnaire_cible;

ALTER TABLE public.tokens_enquete_publique
  DROP CONSTRAINT IF EXISTS tokens_enquete_publique_questionnaire_check;

-- Nouvelle contrainte questionnaire : A, B, C (et futurs D...)
ALTER TABLE public.tokens_enquete_publique
  ADD CONSTRAINT chk_tokens_questionnaire_valide
  CHECK (questionnaire IN ('A', 'B', 'C', 'D'));

-- Nouvelle contrainte coherence questionnaire <-> cible
-- Beneficiaire : A ou C
-- Structure : B (ou D pour future admin form)
ALTER TABLE public.tokens_enquete_publique
  ADD CONSTRAINT chk_tokens_questionnaire_cible
  CHECK (
    (cible_type = 'beneficiaire' AND questionnaire IN ('A', 'C'))
    OR (cible_type = 'structure' AND questionnaire IN ('B', 'D'))
  );
