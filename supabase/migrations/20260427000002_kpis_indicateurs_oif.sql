-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 015 : KPI indicateurs OIF V1
-- -----------------------------------------------------------------------------
-- Étape 9 — Dashboards.
--
-- Fonction unique qui retourne en JSONB :
--   • 5 indicateurs OIF stratégiques (A1, A4 proxy, B1, B4, F1 placeholder)
--   • Données bar chart : top 10 projets par nombre de bénéficiaires
--   • Données pie chart : répartition bénéficiaires par programme
--     stratégique (PS1/PS2/PS3)
--
-- Scope par rôle :
--   • admin_scs               → toute la plateforme
--   • editeur_projet          → ses projets (current_projets_geres)
--   • contributeur_partenaire → bénéficiaires créés par lui ou son org
--   • lecteur                 → périmètre lecture (org + projets visibles)
--
-- Filtre période (paramètre p_periode) :
--   '7j' | '30j' | '90j' | 'all'  (défaut : 'all')
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role IS NULL THEN RETURN jsonb_build_object('erreur', 'pas_de_profil'); END IF;

  v_projets := public.current_projets_geres();

  -- Période → date pivot
  v_date_min := CASE p_periode
    WHEN '7j' THEN NOW() - INTERVAL '7 days'
    WHEN '30j' THEN NOW() - INTERVAL '30 days'
    WHEN '90j' THEN NOW() - INTERVAL '90 days'
    ELSE NULL  -- 'all' = pas de filtre
  END;

  -- =========================================================================
  -- A1 : Bénéficiaires (jeunes formés)
  -- =========================================================================
  WITH base AS (
    SELECT b.sexe, b.created_at
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sexe = 'F'),
    COUNT(*) FILTER (WHERE sexe = 'M')
  INTO v_a1_total, v_a1_femmes, v_a1_hommes
  FROM base;

  -- =========================================================================
  -- B1 : Structures appuyées + B4 : emplois créés (estimation déclarative)
  -- =========================================================================
  WITH base AS (
    SELECT s.emplois_crees
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND (v_date_min IS NULL OR s.created_at >= v_date_min)
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (s.created_by = v_uid OR s.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (s.organisation_id = v_org OR s.projet_code = ANY(v_projets)))
      )
  )
  SELECT COUNT(*), COALESCE(SUM(emplois_crees), 0)
  INTO v_b1_total, v_b4_emplois
  FROM base;

  -- =========================================================================
  -- Bar chart : top 10 projets par bénéficiaires (scope rôle)
  -- =========================================================================
  WITH agg AS (
    SELECT b.projet_code, COUNT(*) AS nb
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
    GROUP BY b.projet_code
    ORDER BY nb DESC
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.projet_code,
    'libelle', p.libelle,
    'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_bar
  FROM agg a
  LEFT JOIN public.projets p ON p.code = a.projet_code;

  -- =========================================================================
  -- Pie chart : répartition par programme stratégique (PS1/PS2/PS3)
  -- =========================================================================
  WITH agg AS (
    SELECT p.programme_strategique AS ps, COUNT(*) AS nb
    FROM public.beneficiaires b
    JOIN public.projets p ON p.code = b.projet_code
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_role = 'admin_scs'
        OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
        OR (v_role = 'contributeur_partenaire'
            AND (b.created_by = v_uid OR b.organisation_id = v_org))
        OR (v_role = 'lecteur'
            AND (b.organisation_id = v_org OR b.projet_code = ANY(v_projets)))
      )
    GROUP BY p.programme_strategique
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.ps,
    'libelle', ps.libelle,
    'beneficiaires', a.nb
  )), '[]'::jsonb)
  INTO v_pie
  FROM agg a
  LEFT JOIN public.programmes_strategiques ps ON ps.code = a.ps;

  RETURN jsonb_build_object(
    'role', v_role,
    'periode', p_periode,
    'scope', CASE
      WHEN v_role = 'admin_scs' THEN 'global'
      WHEN v_role = 'editeur_projet' THEN 'projets_geres'
      ELSE 'organisation'
    END,
    'indicateurs', jsonb_build_object(
      'A1', jsonb_build_object(
        'libelle', 'Jeunes formés',
        'valeur', v_a1_total,
        'femmes', v_a1_femmes,
        'hommes', v_a1_hommes
      ),
      'A4', jsonb_build_object(
        'libelle', 'Gain de compétences',
        'valeur', NULL,
        'proxy', 'Phase 2 — questionnaires Diapo D2'
      ),
      'B1', jsonb_build_object(
        'libelle', 'Activités économiques appuyées',
        'valeur', v_b1_total
      ),
      'B4', jsonb_build_object(
        'libelle', 'Emplois indirects estimés',
        'valeur', v_b4_emplois,
        'mention', 'Estimation déclarative'
      ),
      'F1', jsonb_build_object(
        'libelle', 'Apport du français à l''employabilité',
        'valeur', NULL,
        'proxy', 'Phase 2 — questionnaires Diapo D3'
      )
    ),
    'bar_projets', COALESCE(v_bar, '[]'::jsonb),
    'pie_programmes', COALESCE(v_pie, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_oif_v1(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_indicateurs_oif_v1 IS
  'Indicateurs OIF stratégiques V1 (A1, A4 proxy, B1, B4, F1 placeholder) + données bar/pie chart pour le dashboard. Scope dérivé du rôle. Filtre période 7j/30j/90j/all.';
