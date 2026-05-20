-- =============================================================================
-- Plateforme OIF Emploi Jeunes -- Migration 028 : questionnaire D (ecosystemes)
-- -----------------------------------------------------------------------------
-- Le questionnaire D (Ecosystemes et conditions de l'emploi) cible les
-- structures exactement comme B (acteurs institutionnels au lieu d'activites
-- economiques, mais meme table cible). Les 3 fonctions strate traitent donc
-- 'D' identiquement a 'B'.
--
-- Modifications :
--   1. lister_strate      : ELSE structures -> ELSIF IN ('B', 'D')
--   2. compter_strate     : idem
--   3. lister_strate_ids  : idem
--   4. CHECK liens_collecte_publique.type et soumissions_collecte.type -> + 'D'
--
-- Compatibilite ascendante : campagnes A/B/C existantes inchangees.
-- =============================================================================


-- =============================================================================
-- 1. lister_strate -- ELSE -> ELSIF IN ('B', 'D')
-- =============================================================================
DROP FUNCTION IF EXISTS public.lister_strate(CHAR, JSONB, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.lister_strate(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb,
  p_recherche TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  libelle TEXT,
  email TEXT,
  pays_code TEXT,
  projet_code TEXT,
  annee INTEGER,
  consentement BOOLEAN,
  tranche_age_declaree TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_uid UUID;
  v_org UUID;
  v_projets TEXT[];
  v_recherche TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN;
  END IF;

  v_projets := public.current_projets_geres();
  v_recherche := CASE
    WHEN p_recherche IS NULL OR length(trim(p_recherche)) = 0 THEN NULL
    ELSE '%' || lower(trim(p_recherche)) || '%'
  END;

  -- A et C -> beneficiaires
  IF p_questionnaire IN ('A', 'C') THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        b.id,
        (b.prenom || ' ' || b.nom) AS libelle,
        b.courriel AS email,
        b.pays_code,
        b.projet_code,
        b.annee_formation AS annee,
        b.consentement_recueilli AS consentement,
        b.tranche_age_declaree
      FROM public.beneficiaires b
      WHERE b.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (b.created_by = v_uid OR b.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR b.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR b.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees'
          OR jsonb_array_length(p_filtres->'annees') = 0
          OR b.annee_formation = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'sexe'
          OR p_filtres->>'sexe' IS NULL
          OR p_filtres->>'sexe' = ''
          OR b.sexe::text = p_filtres->>'sexe'
        )
        AND (
          NOT p_filtres ? 'statuts'
          OR jsonb_array_length(p_filtres->'statuts') = 0
          OR b.statut_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'statuts'))
        )
        AND (
          NOT p_filtres ? 'tranche_age'
          OR p_filtres->>'tranche_age' IS NULL
          OR p_filtres->>'tranche_age' = ''
          OR b.tranche_age_declaree = p_filtres->>'tranche_age'
        )
        AND (
          v_recherche IS NULL
          OR lower(b.prenom) LIKE v_recherche
          OR lower(b.nom) LIKE v_recherche
          OR lower(coalesce(b.courriel, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT
      counted.id,
      counted.libelle,
      counted.email,
      counted.pays_code,
      counted.projet_code,
      counted.annee,
      counted.consentement,
      counted.tranche_age_declaree,
      counted.total_count
    FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  -- B et D -> structures
  ELSIF p_questionnaire IN ('B', 'D') THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        s.id,
        s.nom_structure AS libelle,
        s.courriel_porteur AS email,
        s.pays_code,
        s.projet_code,
        s.annee_appui AS annee,
        s.consentement_recueilli AS consentement,
        NULL::TEXT AS tranche_age_declaree
      FROM public.structures s
      WHERE s.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (s.created_by = v_uid OR s.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR s.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR s.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees_appui'
          OR jsonb_array_length(p_filtres->'annees_appui') = 0
          OR s.annee_appui = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees_appui'))::INTEGER)
        )
        AND (
          v_recherche IS NULL
          OR lower(s.nom_structure) LIKE v_recherche
          OR lower(coalesce(s.courriel_porteur, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT
      counted.id,
      counted.libelle,
      counted.email,
      counted.pays_code,
      counted.projet_code,
      counted.annee,
      counted.consentement,
      counted.tranche_age_declaree,
      counted.total_count
    FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;


-- =============================================================================
-- 2. compter_strate -- ELSE -> ELSIF IN ('B', 'D')
-- =============================================================================
CREATE OR REPLACE FUNCTION public.compter_strate(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_uid UUID;
  v_org UUID;
  v_projets TEXT[];
  v_total INTEGER;
  v_avec_email INTEGER;
  v_sans_email INTEGER;
  v_sans_consentement INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN jsonb_build_object('erreur', 'reserve');
  END IF;

  v_projets := public.current_projets_geres();
  v_total := 0;
  v_avec_email := 0;
  v_sans_email := 0;
  v_sans_consentement := 0;

  IF p_questionnaire IN ('A', 'C') THEN
    WITH base AS (
      SELECT b.id, b.courriel, b.consentement_recueilli
      FROM public.beneficiaires b
      WHERE b.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (b.created_by = v_uid OR b.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR b.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR b.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees'
          OR jsonb_array_length(p_filtres->'annees') = 0
          OR b.annee_formation = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'sexe'
          OR p_filtres->>'sexe' IS NULL
          OR p_filtres->>'sexe' = ''
          OR b.sexe::text = p_filtres->>'sexe'
        )
        AND (
          NOT p_filtres ? 'statuts'
          OR jsonb_array_length(p_filtres->'statuts') = 0
          OR b.statut_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'statuts'))
        )
        AND (
          NOT p_filtres ? 'tranche_age'
          OR p_filtres->>'tranche_age' IS NULL
          OR p_filtres->>'tranche_age' = ''
          OR b.tranche_age_declaree = p_filtres->>'tranche_age'
        )
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE courriel IS NOT NULL AND courriel <> '' AND consentement_recueilli),
      COUNT(*) FILTER (WHERE courriel IS NULL OR courriel = '' OR NOT consentement_recueilli),
      COUNT(*) FILTER (WHERE NOT consentement_recueilli)
    INTO v_total, v_avec_email, v_sans_email, v_sans_consentement
    FROM base;
  ELSIF p_questionnaire IN ('B', 'D') THEN
    WITH base AS (
      SELECT s.id, s.courriel_porteur AS courriel, s.consentement_recueilli
      FROM public.structures s
      WHERE s.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (s.created_by = v_uid OR s.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR s.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR s.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees_appui'
          OR jsonb_array_length(p_filtres->'annees_appui') = 0
          OR s.annee_appui = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees_appui'))::INTEGER)
        )
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE courriel IS NOT NULL AND courriel <> '' AND consentement_recueilli),
      COUNT(*) FILTER (WHERE courriel IS NULL OR courriel = '' OR NOT consentement_recueilli),
      COUNT(*) FILTER (WHERE NOT consentement_recueilli)
    INTO v_total, v_avec_email, v_sans_email, v_sans_consentement
    FROM base;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'avec_email', v_avec_email,
    'sans_email', v_sans_email,
    'sans_consentement', v_sans_consentement
  );
END;
$$;


-- =============================================================================
-- 3. lister_strate_ids -- ELSE -> ELSIF IN ('B', 'D')
-- =============================================================================
CREATE OR REPLACE FUNCTION public.lister_strate_ids(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_uid UUID;
  v_org UUID;
  v_projets TEXT[];
  v_ids UUID[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN ARRAY[]::UUID[]; END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  v_projets := public.current_projets_geres();

  IF p_questionnaire IN ('A', 'C') THEN
    SELECT COALESCE(array_agg(b.id), ARRAY[]::UUID[]) INTO v_ids
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
      )
      AND (
        NOT p_filtres ? 'projets'
        OR jsonb_array_length(p_filtres->'projets') = 0
        OR b.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
      )
      AND (
        NOT p_filtres ? 'pays'
        OR jsonb_array_length(p_filtres->'pays') = 0
        OR b.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
      )
      AND (
        NOT p_filtres ? 'annees'
        OR jsonb_array_length(p_filtres->'annees') = 0
        OR b.annee_formation = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees'))::INTEGER)
      )
      AND (
        NOT p_filtres ? 'sexe'
        OR p_filtres->>'sexe' IS NULL
        OR p_filtres->>'sexe' = ''
        OR b.sexe::text = p_filtres->>'sexe'
      )
      AND (
        NOT p_filtres ? 'statuts'
        OR jsonb_array_length(p_filtres->'statuts') = 0
        OR b.statut_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'statuts'))
      )
      AND (
        NOT p_filtres ? 'tranche_age'
        OR p_filtres->>'tranche_age' IS NULL
        OR p_filtres->>'tranche_age' = ''
        OR b.tranche_age_declaree = p_filtres->>'tranche_age'
      );
  ELSIF p_questionnaire IN ('B', 'D') THEN
    SELECT COALESCE(array_agg(s.id), ARRAY[]::UUID[]) INTO v_ids
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (s.created_by = v_uid OR s.organisation_id = v_org))
      )
      AND (
        NOT p_filtres ? 'projets'
        OR jsonb_array_length(p_filtres->'projets') = 0
        OR s.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
      )
      AND (
        NOT p_filtres ? 'pays'
        OR jsonb_array_length(p_filtres->'pays') = 0
        OR s.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
      )
      AND (
        NOT p_filtres ? 'annees_appui'
        OR jsonb_array_length(p_filtres->'annees_appui') = 0
        OR s.annee_appui = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees_appui'))::INTEGER)
      );
  ELSE
    v_ids := ARRAY[]::UUID[];
  END IF;

  RETURN v_ids;
END;
$$;


-- =============================================================================
-- 4. CHECK constraints -- elargir liens_collecte_publique et soumissions_collecte
-- =============================================================================

ALTER TABLE public.liens_collecte_publique
  DROP CONSTRAINT IF EXISTS liens_collecte_publique_type_check;
ALTER TABLE public.liens_collecte_publique
  ADD CONSTRAINT liens_collecte_publique_type_check
  CHECK (type IN ('A', 'B', 'C', 'D'));

ALTER TABLE public.soumissions_collecte
  DROP CONSTRAINT IF EXISTS soumissions_collecte_type_check;
ALTER TABLE public.soumissions_collecte
  ADD CONSTRAINT soumissions_collecte_type_check
  CHECK (type IN ('A', 'B', 'C', 'D'));


COMMENT ON FUNCTION public.lister_strate IS
  'Retourne les cibles paginees. A/C -> beneficiaires ; B/D -> structures. Migration 028.';
COMMENT ON FUNCTION public.compter_strate IS
  'Compte les cibles eligibles. A/C -> beneficiaires ; B/D -> structures. Migration 028.';
COMMENT ON FUNCTION public.lister_strate_ids IS
  'Retourne les UUID des cibles. A/C -> beneficiaires ; B/D -> structures. Migration 028.';
