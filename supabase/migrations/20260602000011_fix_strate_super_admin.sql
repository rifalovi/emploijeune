-- =============================================================================
-- Migration 20260602000011 — Fix compter_strate + lister_strate_ids : super_admin
-- -----------------------------------------------------------------------------
-- Bug : super_admin etait exclu du guard v_role NOT IN (...) dans les 3 RPC
-- strate (lister_strate, compter_strate, lister_strate_ids).
-- lister_strate corrige dans 20260602000010, les 2 autres ici.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compter_strate(p_questionnaire character, p_filtres jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_role NOT IN ('super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
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
          v_role IN ('super_admin', 'admin_scs')
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
          v_role IN ('super_admin', 'admin_scs')
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
$function$

;
;
CREATE OR REPLACE FUNCTION public.lister_strate_ids(p_questionnaire character, p_filtres jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_role NOT IN ('super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  v_projets := public.current_projets_geres();

  IF p_questionnaire IN ('A', 'C') THEN
    SELECT COALESCE(array_agg(b.id), ARRAY[]::UUID[]) INTO v_ids
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (
        v_role IN ('super_admin', 'admin_scs')
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
        v_role IN ('super_admin', 'admin_scs')
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
$function$

