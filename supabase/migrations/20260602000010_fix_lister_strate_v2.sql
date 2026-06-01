-- =============================================================================
-- Migration 20260602000010 — Fix lister_strate : restaurer tranche_age_declaree
-- -----------------------------------------------------------------------------
-- Cause racine : un hotfix precedent a retire tranche_age_declaree du
--   RETURN TABLE pour corriger un mismatch de type (SMALLINT vs INTEGER
--   sur annee_formation). Le fix etait correct pour le cast mais a
--   perdu la colonne tranche_age_declaree. Le code TypeScript l'attend.
--
-- Cette migration restaure la version complete avec :
--   - tranche_age_declaree dans le RETURN TABLE
--   - casts ::INTEGER sur annee_formation et annee_appui
--   - support des questionnaires C et D (en plus de A et B)
-- =============================================================================

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

  -- A et C → beneficiaires
  IF p_questionnaire IN ('A', 'C') THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        b.id,
        (b.prenom || ' ' || b.nom) AS libelle,
        b.courriel AS email,
        b.pays_code,
        b.projet_code,
        b.annee_formation::INTEGER AS annee,
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

  -- B et D → structures
  ELSIF p_questionnaire IN ('B', 'D') THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        s.id,
        s.nom_structure AS libelle,
        s.courriel_porteur AS email,
        s.pays_code,
        s.projet_code,
        s.annee_appui::INTEGER AS annee,
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
          NOT p_filtres ? 'types_structure'
          OR jsonb_array_length(p_filtres->'types_structure') = 0
          OR s.type_structure_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'types_structure'))
        )
        AND (
          NOT p_filtres ? 'secteurs'
          OR jsonb_array_length(p_filtres->'secteurs') = 0
          OR s.secteur_activite_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'secteurs'))
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
