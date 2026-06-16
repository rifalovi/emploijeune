-- =============================================================================
-- Migration 20260616000004 — TCD structures : dimension « Porteur »
-- -----------------------------------------------------------------------------
-- Ajoute le porteur (prénom + nom) comme dimension du cube B1, pour observer le
-- nombre de structures par porteur (un porteur peut en porter plusieurs).
-- Recrée cube_structures_v1 en ajoutant `porteur` au GROUP BY et au JSON.
-- =============================================================================

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
    'porteur', porteur,
    'n', n,
    'emplois', emplois,
    'montant', montant
  )), '[]'::JSONB) INTO v_res
  FROM (
    SELECT projet_code, pays_code, type_structure_code, secteur_activite_code,
           statut_creation, annee_appui, nature_appui_code,
           COALESCE(
             NULLIF(TRIM(COALESCE(porteur_prenom, '') || ' ' || COALESCE(porteur_nom, '')), ''),
             '—'
           ) AS porteur,
           COUNT(*)::INTEGER AS n,
           COALESCE(SUM(emplois_crees), 0)::INTEGER AS emplois,
           ROUND(COALESCE(SUM(montant_appui), 0))::NUMERIC AS montant
    FROM public.structures
    WHERE deleted_at IS NULL
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR projet_code = ANY(v_projets))
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  ) g;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cube_structures_v1() TO authenticated;
