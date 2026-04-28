-- =============================================================================
-- HOTFIX v2.0.0 — B4 affiche « À venir » par cohérence avec A4 et F1
-- -----------------------------------------------------------------------------
-- Constat : la colonne `structures.emplois_crees` n'est jamais remplie en V1
-- (donnée collectée via questionnaire B au pilote juin 2026). B4 retournait
-- donc 0 avec la mention « Estimation déclarative », ce qui prêtait à
-- confusion à l'utilisateur qui voyait un chiffre nul présenté comme
-- estimation.
--
-- Décision : par cohérence avec A4 et F1 (qui retournent NULL + proxy car
-- ils dépendent eux aussi de questionnaires longitudinaux non alimentés en
-- V1), B4 est désormais traité de la même manière : valeur = NULL,
-- proxy = « Phase 2 — questionnaire B (Q210/Q212/Q213) ».
--
-- Modification minimale : seule la ligne du jsonb_build_object pour B4
-- change dans les deux fonctions (`get_indicateurs_oif_v1` et la variante
-- `_for_user`). Les calculs internes de v_b4_emplois sont conservés tels
-- quels (overhead négligeable, simplifie le diff).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_indicateurs_oif_v1(p_periode TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_org UUID;
  v_uid UUID;
  v_projets TEXT[];
  v_date_min TIMESTAMPTZ;
  v_a1_total INTEGER;
  v_a1_femmes INTEGER;
  v_a1_hommes INTEGER;
  v_b1_total INTEGER;
  v_b4_emplois INTEGER;
  v_bar JSONB;
  v_pie JSONB;
  v_bar_pays JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role IS NULL THEN RETURN jsonb_build_object('erreur', 'pas_de_profil'); END IF;

  v_projets := public.current_projets_geres();

  v_date_min := CASE p_periode
    WHEN '7j' THEN NOW() - INTERVAL '7 days'
    WHEN '30j' THEN NOW() - INTERVAL '30 days'
    WHEN '90j' THEN NOW() - INTERVAL '90 days'
    ELSE NULL
  END;

  WITH base AS (
    SELECT b.sexe FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role IN ('admin_scs', 'super_admin')
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE sexe = 'F'), COUNT(*) FILTER (WHERE sexe = 'M')
  INTO v_a1_total, v_a1_femmes, v_a1_hommes FROM base;

  WITH base AS (
    SELECT s.emplois_crees FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND (v_date_min IS NULL OR s.created_at >= v_date_min)
      AND (
        v_role IN ('admin_scs', 'super_admin')
        OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (s.created_by = v_uid OR s.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (s.organisation_id = v_org OR s.projet_code = ANY(v_projets)))
      )
  )
  SELECT COUNT(*), COALESCE(SUM(emplois_crees), 0)
  INTO v_b1_total, v_b4_emplois FROM base;

  WITH agg AS (
    SELECT b.projet_code, COUNT(*) AS nb FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role IN ('admin_scs', 'super_admin')
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
    GROUP BY b.projet_code ORDER BY nb DESC LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.projet_code, 'libelle', p.libelle, 'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_bar
  FROM agg a LEFT JOIN public.projets p ON p.code = a.projet_code;

  WITH agg AS (
    SELECT p.programme_strategique AS ps, COUNT(*) AS nb FROM public.beneficiaires b
    JOIN public.projets p ON p.code = b.projet_code
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role IN ('admin_scs', 'super_admin')
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
    GROUP BY p.programme_strategique
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.ps, 'libelle', ps.libelle, 'beneficiaires', a.nb
  )), '[]'::jsonb)
  INTO v_pie
  FROM agg a LEFT JOIN public.programmes_strategiques ps ON ps.code = a.ps;

  WITH agg AS (
    SELECT b.pays_code, COUNT(*) AS nb FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role IN ('admin_scs', 'super_admin')
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
    GROUP BY b.pays_code ORDER BY nb DESC LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.pays_code, 'libelle', pa.libelle_fr, 'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_bar_pays
  FROM agg a LEFT JOIN public.pays pa ON pa.code_iso = a.pays_code;

  RETURN jsonb_build_object(
    'role', v_role,
    'periode', p_periode,
    'scope', CASE
      WHEN v_role IN ('admin_scs', 'super_admin') THEN 'global'
      WHEN v_role = 'editeur_projet' THEN 'projets_geres'
      ELSE 'organisation'
    END,
    'indicateurs', jsonb_build_object(
      'A1', jsonb_build_object('libelle', 'Jeunes formés', 'valeur', v_a1_total, 'femmes', v_a1_femmes, 'hommes', v_a1_hommes),
      'A4', jsonb_build_object('libelle', 'Gain de compétences', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D2'),
      'B1', jsonb_build_object('libelle', 'Activités économiques appuyées', 'valeur', v_b1_total),
      -- HOTFIX v2.0.0 : B4 désormais NULL + proxy par cohérence avec A4/F1
      'B4', jsonb_build_object('libelle', 'Emplois indirects estimés', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaire B (Q210/Q212/Q213)'),
      'F1', jsonb_build_object('libelle', 'Apport du français à l''employabilité', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D3')
    ),
    'bar_projets', COALESCE(v_bar, '[]'::jsonb),
    'pie_programmes', COALESCE(v_pie, '[]'::jsonb),
    'bar_pays', COALESCE(v_bar_pays, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_oif_v1(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Variante view-as : même hotfix B4
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_indicateurs_oif_v1_for_user(
  p_target_user_id UUID,
  p_periode TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_role public.role_utilisateur;
  v_target_role public.role_utilisateur;
  v_target_org UUID;
  v_target_projets TEXT[];
  v_date_min TIMESTAMPTZ;
  v_a1_total INTEGER;
  v_a1_femmes INTEGER;
  v_a1_hommes INTEGER;
  v_b1_total INTEGER;
  v_b4_emplois INTEGER;
  v_bar JSONB;
  v_pie JSONB;
  v_bar_pays JSONB;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role INTO v_caller_role
  FROM public.utilisateurs
  WHERE user_id = v_caller_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  -- View-as : autorisé pour admin_scs et super_admin
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin_scs', 'super_admin') THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin');
  END IF;

  SELECT role, organisation_id INTO v_target_role, v_target_org
  FROM public.utilisateurs
  WHERE user_id = p_target_user_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_target_role IS NULL THEN RETURN jsonb_build_object('erreur', 'cible_introuvable'); END IF;

  IF v_target_role IN ('admin_scs', 'super_admin') THEN
    SELECT COALESCE(array_agg(code), ARRAY[]::TEXT[]) INTO v_target_projets FROM public.projets;
  ELSIF v_target_role = 'editeur_projet' THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.affectation_projet_courante WHERE user_id = p_target_user_id;
  ELSIF v_target_role = 'contributeur_partenaire' AND v_target_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.structures WHERE organisation_id = v_target_org AND deleted_at IS NULL;
  ELSIF v_target_role = 'lecteur' AND v_target_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT a.projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.affectation_projet_courante a
    JOIN public.utilisateurs u ON u.user_id = a.user_id
    WHERE u.organisation_id = v_target_org AND u.actif = TRUE AND u.deleted_at IS NULL;
  ELSE
    v_target_projets := ARRAY[]::TEXT[];
  END IF;

  v_date_min := CASE p_periode
    WHEN '7j' THEN NOW() - INTERVAL '7 days'
    WHEN '30j' THEN NOW() - INTERVAL '30 days'
    WHEN '90j' THEN NOW() - INTERVAL '90 days'
    ELSE NULL
  END;

  WITH base AS (
    SELECT b.sexe FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role IN ('admin_scs', 'super_admin')
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE sexe = 'F'), COUNT(*) FILTER (WHERE sexe = 'M')
  INTO v_a1_total, v_a1_femmes, v_a1_hommes FROM base;

  WITH base AS (
    SELECT s.emplois_crees FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND (v_date_min IS NULL OR s.created_at >= v_date_min)
      AND (
        v_target_role IN ('admin_scs', 'super_admin')
        OR (v_target_role = 'editeur_projet' AND s.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (s.created_by = p_target_user_id OR s.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (s.organisation_id = v_target_org OR s.projet_code = ANY(v_target_projets)))
      )
  )
  SELECT COUNT(*), COALESCE(SUM(emplois_crees), 0) INTO v_b1_total, v_b4_emplois FROM base;

  WITH agg AS (
    SELECT b.projet_code, COUNT(*) AS nb FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role IN ('admin_scs', 'super_admin')
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
    GROUP BY b.projet_code ORDER BY nb DESC LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.projet_code, 'libelle', p.libelle, 'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_bar
  FROM agg a LEFT JOIN public.projets p ON p.code = a.projet_code;

  WITH agg AS (
    SELECT p.programme_strategique AS ps, COUNT(*) AS nb FROM public.beneficiaires b
    JOIN public.projets p ON p.code = b.projet_code
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role IN ('admin_scs', 'super_admin')
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
    GROUP BY p.programme_strategique
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.ps, 'libelle', ps.libelle, 'beneficiaires', a.nb
  )), '[]'::jsonb)
  INTO v_pie
  FROM agg a LEFT JOIN public.programmes_strategiques ps ON ps.code = a.ps;

  WITH agg AS (
    SELECT b.pays_code, COUNT(*) AS nb FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role IN ('admin_scs', 'super_admin')
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
    GROUP BY b.pays_code ORDER BY nb DESC LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.pays_code, 'libelle', pa.libelle_fr, 'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_bar_pays
  FROM agg a LEFT JOIN public.pays pa ON pa.code_iso = a.pays_code;

  RETURN jsonb_build_object(
    'role', v_target_role,
    'periode', p_periode,
    'scope', CASE
      WHEN v_target_role IN ('admin_scs', 'super_admin') THEN 'global'
      WHEN v_target_role = 'editeur_projet' THEN 'projets_geres'
      ELSE 'organisation'
    END,
    'indicateurs', jsonb_build_object(
      'A1', jsonb_build_object('libelle', 'Jeunes formés', 'valeur', v_a1_total, 'femmes', v_a1_femmes, 'hommes', v_a1_hommes),
      'A4', jsonb_build_object('libelle', 'Gain de compétences', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D2'),
      'B1', jsonb_build_object('libelle', 'Activités économiques appuyées', 'valeur', v_b1_total),
      -- HOTFIX v2.0.0 : B4 désormais NULL + proxy
      'B4', jsonb_build_object('libelle', 'Emplois indirects estimés', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaire B (Q210/Q212/Q213)'),
      'F1', jsonb_build_object('libelle', 'Apport du français à l''employabilité', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D3')
    ),
    'bar_projets', COALESCE(v_bar, '[]'::jsonb),
    'pie_programmes', COALESCE(v_pie, '[]'::jsonb),
    'bar_pays', COALESCE(v_bar_pays, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_oif_v1_for_user(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_indicateurs_oif_v1 IS
  'KPI dashboard V1 (v2.0.0). Inclut super_admin = traitement equivalent admin_scs (vue globale). B4 NULL + proxy par coherence A4/F1.';
