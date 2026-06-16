-- =============================================================================
-- Migration 20260615000004 — Cubes d'agrégation pour le TCD (A1 / B1)
-- -----------------------------------------------------------------------------
-- Pré-agrège bénéficiaires (A1) et structures (B1) par TOUTES les dimensions
-- utiles, avec décompte (+ sommes pour B1). Le résultat (quelques centaines/
-- milliers de combinaisons) alimente le tableau croisé dynamique côté client,
-- qui pivote instantanément sans nouvelle requête.
--
-- Scope par rôle : super_admin / admin_scs voient tout ; les autres rôles sont
-- limités à leurs projets gérés (current_projets_geres()).
-- Fonctions STABLE (lecture seule).
-- =============================================================================

-- A1 — Bénéficiaires -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cube_beneficiaires_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_role    public.role_utilisateur;
  v_projets TEXT[];
  v_res     JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::JSONB; END IF;
  SELECT role INTO v_role FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL LIMIT 1;
  IF v_role IS NULL THEN RETURN '[]'::JSONB; END IF;
  v_projets := public.current_projets_geres();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sexe',    COALESCE(sexe::TEXT, '—'),
    'projet',  COALESCE(projet_code, '—'),
    'pays',    COALESCE(pays_code, '—'),
    'domaine', COALESCE(domaine_formation_code, '—'),
    'annee',   COALESCE(annee_formation::TEXT, '—'),
    'tranche', COALESCE(tranche_age_declaree::TEXT, '—'),
    'statut',  COALESCE(statut_code::TEXT, '—'),
    'n', n
  )), '[]'::JSONB) INTO v_res
  FROM (
    SELECT sexe, projet_code, pays_code, domaine_formation_code, annee_formation,
           tranche_age_declaree, statut_code, COUNT(*)::INTEGER AS n
    FROM public.beneficiaires
    WHERE deleted_at IS NULL
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR projet_code = ANY(v_projets))
    GROUP BY 1, 2, 3, 4, 5, 6, 7
  ) g;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cube_beneficiaires_v1() TO authenticated;

-- B1 — Structures --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cube_structures_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_role    public.role_utilisateur;
  v_projets TEXT[];
  v_res     JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::JSONB; END IF;
  SELECT role INTO v_role FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL LIMIT 1;
  IF v_role IS NULL THEN RETURN '[]'::JSONB; END IF;
  v_projets := public.current_projets_geres();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'projet',  COALESCE(projet_code, '—'),
    'pays',    COALESCE(pays_code, '—'),
    'type',    COALESCE(type_structure_code, '—'),
    'secteur', COALESCE(secteur_activite_code, '—'),
    'statut',  COALESCE(statut_creation::TEXT, '—'),
    'annee',   COALESCE(annee_appui::TEXT, '—'),
    'nature',  COALESCE(nature_appui_code, '—'),
    'n', n,
    'emplois', emplois,
    'montant', montant
  )), '[]'::JSONB) INTO v_res
  FROM (
    SELECT projet_code, pays_code, type_structure_code, secteur_activite_code,
           statut_creation, annee_appui, nature_appui_code,
           COUNT(*)::INTEGER AS n,
           COALESCE(SUM(emplois_crees), 0)::INTEGER AS emplois,
           ROUND(COALESCE(SUM(montant_appui), 0))::NUMERIC AS montant
    FROM public.structures
    WHERE deleted_at IS NULL
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR projet_code = ANY(v_projets))
    GROUP BY 1, 2, 3, 4, 5, 6, 7
  ) g;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cube_structures_v1() TO authenticated;
