-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 016 : view-as utilisateur (admin SCS)
-- -----------------------------------------------------------------------------
-- Objectif : permettre à un admin_scs de visualiser les dashboards/KPI comme
-- s'il était un autre utilisateur (cas d'usage : support, démo, audit RGPD).
--
-- Architecture V1.1.5 :
--   • Le mode view-as est piloté par un cookie httpOnly signé côté Next.js
--     (`oif_view_as`) — pas de modification du JWT Supabase ni de la RLS.
--   • Cette migration ajoute UNE seule fonction PostgreSQL :
--     `get_indicateurs_oif_v1_for_user(p_target_user_id, p_periode)` qui
--     retourne le payload KPI comme si l'utilisateur cible interrogeait sa
--     propre fonction `get_indicateurs_oif_v1`. Réservée admin_scs.
--   • Les valeurs ENUM `action_audit` sont étendues avec VIEW_AS_START et
--     VIEW_AS_END pour tracer les entrées/sorties de mode view-as dans
--     `journaux_audit`.
--
-- Hors scope V1.1.5 (V2 si demande terrain) :
--   • Bascule réelle de la RLS Postgres : la lecture des listes
--     bénéficiaires/structures reste filtrée comme l'admin (qui voit tout).
--     Seul le DASHBOARD est simulé pour le rôle cible. Adapté aux 4 cas
--     d'usage Carlos (support, démo, audit, contrôle permissions
--     dashboards). Pour un test RLS strict, créer un compte de test.
-- =============================================================================

-- 1. Étendre l'ENUM action_audit (idempotent)
ALTER TYPE public.action_audit ADD VALUE IF NOT EXISTS 'VIEW_AS_START';
ALTER TYPE public.action_audit ADD VALUE IF NOT EXISTS 'VIEW_AS_END';

-- 2. Variante view-as de get_indicateurs_oif_v1
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
BEGIN
  -- 2.1. Garde admin_scs
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.utilisateurs
  WHERE user_id = v_caller_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'admin_scs' THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin_scs');
  END IF;

  -- 2.2. Profil cible
  SELECT role, organisation_id INTO v_target_role, v_target_org
  FROM public.utilisateurs
  WHERE user_id = p_target_user_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('erreur', 'cible_introuvable');
  END IF;

  -- 2.3. Projets gérés du cible (mêmes règles que current_projets_geres)
  IF v_target_role = 'admin_scs' THEN
    SELECT COALESCE(array_agg(code), ARRAY[]::TEXT[]) INTO v_target_projets FROM public.projets;
  ELSIF v_target_role = 'editeur_projet' THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.affectation_projet_courante
    WHERE user_id = p_target_user_id;
  ELSIF v_target_role = 'contributeur_partenaire' AND v_target_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.structures
    WHERE organisation_id = v_target_org AND deleted_at IS NULL;
  ELSIF v_target_role = 'lecteur' AND v_target_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT a.projet_code), ARRAY[]::TEXT[]) INTO v_target_projets
    FROM public.affectation_projet_courante a
    JOIN public.utilisateurs u ON u.user_id = a.user_id
    WHERE u.organisation_id = v_target_org AND u.actif = TRUE AND u.deleted_at IS NULL;
  ELSE
    v_target_projets := ARRAY[]::TEXT[];
  END IF;

  -- 2.4. Période
  v_date_min := CASE p_periode
    WHEN '7j' THEN NOW() - INTERVAL '7 days'
    WHEN '30j' THEN NOW() - INTERVAL '30 days'
    WHEN '90j' THEN NOW() - INTERVAL '90 days'
    ELSE NULL
  END;

  -- 2.5. A1 — Bénéficiaires
  WITH base AS (
    SELECT b.sexe FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role = 'admin_scs'
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE sexe = 'F'), COUNT(*) FILTER (WHERE sexe = 'M')
  INTO v_a1_total, v_a1_femmes, v_a1_hommes FROM base;

  -- 2.6. B1 + B4 — Structures et emplois indirects
  WITH base AS (
    SELECT s.emplois_crees FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND (v_date_min IS NULL OR s.created_at >= v_date_min)
      AND (
        v_target_role = 'admin_scs'
        OR (v_target_role = 'editeur_projet' AND s.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (s.created_by = p_target_user_id OR s.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (s.organisation_id = v_target_org OR s.projet_code = ANY(v_target_projets)))
      )
  )
  SELECT COUNT(*), COALESCE(SUM(emplois_crees), 0)
  INTO v_b1_total, v_b4_emplois FROM base;

  -- 2.7. Bar chart top 10 projets
  WITH agg AS (
    SELECT b.projet_code, COUNT(*) AS nb FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role = 'admin_scs'
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
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
  FROM agg a LEFT JOIN public.projets p ON p.code = a.projet_code;

  -- 2.8. Pie chart par programme stratégique
  WITH agg AS (
    SELECT p.programme_strategique AS ps, COUNT(*) AS nb FROM public.beneficiaires b
    JOIN public.projets p ON p.code = b.projet_code
    WHERE b.deleted_at IS NULL
      AND (v_date_min IS NULL OR b.created_at >= v_date_min)
      AND (
        v_target_role = 'admin_scs'
        OR (v_target_role = 'editeur_projet' AND b.projet_code = ANY(v_target_projets))
        OR (v_target_role = 'contributeur_partenaire'
            AND (b.created_by = p_target_user_id OR b.organisation_id = v_target_org))
        OR (v_target_role = 'lecteur'
            AND (b.organisation_id = v_target_org OR b.projet_code = ANY(v_target_projets)))
      )
    GROUP BY p.programme_strategique
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.ps,
    'libelle', ps.libelle,
    'beneficiaires', a.nb
  )), '[]'::jsonb)
  INTO v_pie
  FROM agg a LEFT JOIN public.programmes_strategiques ps ON ps.code = a.ps;

  RETURN jsonb_build_object(
    'role', v_target_role,
    'periode', p_periode,
    'scope', CASE
      WHEN v_target_role = 'admin_scs' THEN 'global'
      WHEN v_target_role = 'editeur_projet' THEN 'projets_geres'
      ELSE 'organisation'
    END,
    'indicateurs', jsonb_build_object(
      'A1', jsonb_build_object('libelle', 'Jeunes formés', 'valeur', v_a1_total, 'femmes', v_a1_femmes, 'hommes', v_a1_hommes),
      'A4', jsonb_build_object('libelle', 'Gain de compétences', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D2'),
      'B1', jsonb_build_object('libelle', 'Activités économiques appuyées', 'valeur', v_b1_total),
      'B4', jsonb_build_object('libelle', 'Emplois indirects estimés', 'valeur', v_b4_emplois, 'mention', 'Estimation déclarative'),
      'F1', jsonb_build_object('libelle', 'Apport du français à l''employabilité', 'valeur', NULL, 'proxy', 'Phase 2 — questionnaires Diapo D3')
    ),
    'bar_projets', COALESCE(v_bar, '[]'::jsonb),
    'pie_programmes', COALESCE(v_pie, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_oif_v1_for_user(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_indicateurs_oif_v1_for_user IS
  'Mode view-as (admin SCS) : retourne les KPI OIF du dashboard comme si l''utilisateur cible interrogeait sa propre fonction. Garde admin_scs côté SECURITY DEFINER. Audit via journaux_audit (action VIEW_AS_START / VIEW_AS_END).';
