-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 025 : lister_strate_ids
-- -----------------------------------------------------------------------------
-- V1.5.1 — Wizard campagnes avec révision manuelle des cibles.
--
-- Fonction légère qui retourne UNIQUEMENT les UUID des cibles éligibles
-- selon un filtre (sans le détail libelle/email/etc.). Utilisée par le
-- wizard pour pré-cocher tous les éligibles en mode « filtres avec
-- révision » (l'utilisateur peut ensuite décocher individuellement).
--
-- Pourquoi pas réutiliser `lister_strate` ? Parce que celle-ci charge le
-- détail complet (libellé + email + pays + projet + total_count via window
-- function) — coûteux pour 5 500 lignes alors qu'on n'a besoin que des
-- UUID pour initialiser le Set<string> côté client.
--
-- Sécurité : SECURITY DEFINER + check rôle (admin_scs / editeur_projet /
-- contributeur_partenaire) reproduit. Filtres rôle identiques à
-- `lister_strate`.
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

  IF p_questionnaire = 'A' THEN
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
      );
  ELSE
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
      );
  END IF;

  RETURN COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_strate_ids(CHAR, JSONB) TO authenticated;

COMMENT ON FUNCTION public.lister_strate_ids IS
  'V1.5.1 — Retourne UNIQUEMENT les UUID des cibles éligibles aux filtres. Léger (~50 KB pour 5 500 IDs en JSON) — utilisé pour pré-cocher tous les éligibles dans le wizard de campagne avant révision manuelle.';
