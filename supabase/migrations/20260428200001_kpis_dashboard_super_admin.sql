-- =============================================================================
-- v2.2.0 — get_kpis_dashboard : super_admin obtient les KPI admin_scs
-- -----------------------------------------------------------------------------
-- Bug v2.0.0 : la fonction get_kpis_dashboard() ne gérait pas le rôle
-- super_admin → renvoyait `{erreur: 'role_inconnu'}` → le frontend affichait
-- « Le format des indicateurs renvoyé par le serveur est inattendu ».
--
-- Fix : super_admin hérite des KPI admin_scs (vue globale identique).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_statut TEXT;
BEGIN
  v_statut := public.current_statut_validation();
  v_role := public.current_role_metier();

  IF v_statut IS NULL THEN
    RETURN jsonb_build_object('erreur', 'pas_de_profil');
  END IF;
  IF v_statut <> 'valide' THEN
    RETURN jsonb_build_object('erreur', 'compte_non_valide', 'statut', v_statut);
  END IF;

  RETURN CASE v_role
    WHEN 'super_admin' THEN public.get_kpis_dashboard_admin_scs()
    WHEN 'admin_scs' THEN public.get_kpis_dashboard_admin_scs()
    WHEN 'editeur_projet' THEN public.get_kpis_dashboard_editeur_projet()
    WHEN 'contributeur_partenaire' THEN public.get_kpis_dashboard_contributeur_partenaire()
    WHEN 'lecteur' THEN public.get_kpis_dashboard_lecteur()
    ELSE jsonb_build_object('erreur', 'role_inconnu')
  END;
END;
$$;

COMMENT ON FUNCTION public.get_kpis_dashboard IS
  'Routeur KPI dashboard par rôle. v2.2.0 : super_admin obtient les KPI admin_scs (vue globale).';
