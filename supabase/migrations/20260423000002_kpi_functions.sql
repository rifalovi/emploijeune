-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 005 : fonctions KPI de dashboard
-- -----------------------------------------------------------------------------
-- Quatre fonctions PostgreSQL (une par rôle) qui agrègent les KPI décidés
-- Q3 Étape 3 et les retournent en JSONB. SLA : < 500 ms sur 10 000 bénéficiaires.
-- Toutes les fonctions sont SECURITY DEFINER : elles lisent les tables en
-- contournant la RLS (pour avoir les vrais totaux) puis filtrent manuellement
-- selon le rôle via les helpers existants.
-- =============================================================================

-- 1. Dashboard admin_scs -------------------------------------------------------
-- KPI : A3 comptes en attente, A4 taux RGPD, A5 alertes qualité, Imports 7j
CREATE OR REPLACE FUNCTION public.get_kpis_dashboard_admin_scs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comptes_en_attente INTEGER;
  v_beneficiaires_total INTEGER;
  v_beneficiaires_consent INTEGER;
  v_taux_rgpd NUMERIC;
  v_alertes INTEGER;
  v_imports_recents INTEGER;
  v_imports_avec_erreurs INTEGER;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RETURN jsonb_build_object('erreur', 'acces_refuse');
  END IF;

  -- A3 : comptes en attente
  SELECT COUNT(*) INTO v_comptes_en_attente
  FROM public.utilisateurs
  WHERE statut_validation = 'en_attente' AND deleted_at IS NULL;

  -- A4 : taux de complétude RGPD (% bénéficiaires avec consentement)
  SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL),
         COUNT(*) FILTER (WHERE consentement_recueilli = TRUE AND deleted_at IS NULL)
    INTO v_beneficiaires_total, v_beneficiaires_consent
  FROM public.beneficiaires;

  v_taux_rgpd := CASE
    WHEN v_beneficiaires_total = 0 THEN 0
    ELSE ROUND(100.0 * v_beneficiaires_consent / v_beneficiaires_total, 1)
  END;

  -- A5 : alertes qualité = (a) consentement recueilli sans date
  --                     + (b) doublons potentiels détectés par l'index unique (comptage indirect)
  --                     + (c) lignes bénéficiaires sans date_naissance
  SELECT
    (SELECT COUNT(*) FROM public.beneficiaires
     WHERE deleted_at IS NULL AND consentement_recueilli = TRUE AND consentement_date IS NULL)
  + (SELECT COUNT(*) FROM public.beneficiaires
     WHERE deleted_at IS NULL AND date_naissance IS NULL)
  + (SELECT COUNT(*) FROM public.structures
     WHERE deleted_at IS NULL AND montant_appui IS NULL AND nature_appui_code = 'SUBVENTION')
    INTO v_alertes;

  -- Imports 7 jours
  SELECT COUNT(*) INTO v_imports_recents
  FROM public.imports_excel
  WHERE deleted_at IS NULL
    AND demarre_a > NOW() - INTERVAL '7 days'
    AND statut IN ('succes', 'echec_partiel', 'echec_total');

  SELECT COUNT(*) INTO v_imports_avec_erreurs
  FROM public.imports_excel
  WHERE deleted_at IS NULL
    AND demarre_a > NOW() - INTERVAL '7 days'
    AND nb_erreurs > 0;

  RETURN jsonb_build_object(
    'role', 'admin_scs',
    'comptes_en_attente', v_comptes_en_attente,
    'taux_rgpd', jsonb_build_object(
      'valeur', v_taux_rgpd,
      'denominateur', v_beneficiaires_total,
      'alerte', (v_taux_rgpd < 80 AND v_beneficiaires_total > 0)
    ),
    'alertes_qualite', v_alertes,
    'imports_recents', jsonb_build_object(
      'total', v_imports_recents,
      'avec_erreurs', v_imports_avec_erreurs,
      'alerte', (v_imports_avec_erreurs > 0)
    )
  );
END;
$$;

-- 2. Dashboard editeur_projet --------------------------------------------------
-- KPI : E1 bénéficiaires projets, E3 taux A2, E4 cohortes à enquêter, E5 contacts valides
CREATE OR REPLACE FUNCTION public.get_kpis_dashboard_editeur_projet()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projets TEXT[];
  v_nb_beneficiaires INTEGER;
  v_nb_acheves INTEGER;
  v_taux_a2 NUMERIC;
  v_cohortes_a_enqueter INTEGER;
  v_nb_avec_contact INTEGER;
  v_nb_consentis INTEGER;
  v_taux_contacts NUMERIC;
BEGIN
  IF public.current_role_metier() <> 'editeur_projet' THEN
    RETURN jsonb_build_object('erreur', 'acces_refuse');
  END IF;

  v_projets := public.current_projets_geres();

  -- E1 : bénéficiaires de mes projets
  SELECT COUNT(*) INTO v_nb_beneficiaires
  FROM public.beneficiaires
  WHERE deleted_at IS NULL AND projet_code = ANY(v_projets);

  -- E3 : taux achèvement (proxy via statut_code = 'FORMATION_ACHEVEE'
  --      en attendant les réponses A2 structurées de la phase 2)
  SELECT COUNT(*) FILTER (WHERE statut_code = 'FORMATION_ACHEVEE') INTO v_nb_acheves
  FROM public.beneficiaires
  WHERE deleted_at IS NULL AND projet_code = ANY(v_projets);

  v_taux_a2 := CASE
    WHEN v_nb_beneficiaires = 0 THEN 0
    ELSE ROUND(100.0 * v_nb_acheves / v_nb_beneficiaires, 1)
  END;

  -- E4 : cohortes à enquêter = bénéficiaires formés il y a 6-12 mois sans réponse A5
  SELECT COUNT(*) INTO v_cohortes_a_enqueter
  FROM public.beneficiaires b
  WHERE b.deleted_at IS NULL
    AND b.projet_code = ANY(v_projets)
    AND b.date_fin_formation IS NOT NULL
    AND b.date_fin_formation BETWEEN NOW() - INTERVAL '13 months' AND NOW() - INTERVAL '5 months'
    AND NOT EXISTS (
      SELECT 1 FROM public.reponses_enquetes r
      WHERE r.beneficiaire_id = b.id
        AND r.indicateur_code = 'A5'
        AND r.deleted_at IS NULL
    );

  -- E5 : taux de contacts valides
  SELECT
    COUNT(*) FILTER (WHERE consentement_recueilli = TRUE),
    COUNT(*) FILTER (WHERE consentement_recueilli = TRUE
                       AND (telephone IS NOT NULL OR courriel IS NOT NULL))
  INTO v_nb_consentis, v_nb_avec_contact
  FROM public.beneficiaires
  WHERE deleted_at IS NULL AND projet_code = ANY(v_projets);

  v_taux_contacts := CASE
    WHEN v_nb_consentis = 0 THEN 0
    ELSE ROUND(100.0 * v_nb_avec_contact / v_nb_consentis, 1)
  END;

  RETURN jsonb_build_object(
    'role', 'editeur_projet',
    'projets_geres', v_projets,
    'beneficiaires_projets', v_nb_beneficiaires,
    'taux_achevement', jsonb_build_object(
      'valeur', v_taux_a2,
      'numerateur', v_nb_acheves,
      'denominateur', v_nb_beneficiaires,
      'proxy', TRUE
    ),
    'cohortes_a_enqueter', v_cohortes_a_enqueter,
    'contacts_valides', jsonb_build_object(
      'valeur', v_taux_contacts,
      'numerateur', v_nb_avec_contact,
      'denominateur', v_nb_consentis,
      'alerte', (v_taux_contacts < 70 AND v_nb_consentis > 0)
    )
  );
END;
$$;

-- 3. Dashboard contributeur_partenaire -----------------------------------------
-- KPI : C1 bénéficiaires saisis, C3 dernier import, C4 complétude, C5 formulaires à remplir
CREATE OR REPLACE FUNCTION public.get_kpis_dashboard_contributeur_partenaire()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_org UUID;
  v_nb_beneficiaires INTEGER;
  v_nb_complets INTEGER;
  v_taux_completude NUMERIC;
  v_dernier_import JSONB;
  v_formulaires_a_remplir INTEGER;
BEGIN
  IF public.current_role_metier() <> 'contributeur_partenaire' THEN
    RETURN jsonb_build_object('erreur', 'acces_refuse');
  END IF;

  v_uid := auth.uid();
  v_org := public.current_organisation_id();

  -- C1 : bénéficiaires saisis par moi
  SELECT COUNT(*) INTO v_nb_beneficiaires
  FROM public.beneficiaires
  WHERE deleted_at IS NULL AND created_by = v_uid;

  -- C3 : dernier import (ma propre création)
  SELECT jsonb_build_object(
    'id', id,
    'fichier_nom', fichier_nom,
    'statut', statut,
    'nb_lignes_a1', nb_lignes_a1,
    'nb_lignes_b1', nb_lignes_b1,
    'nb_erreurs', nb_erreurs,
    'nb_avertissements', nb_avertissements,
    'demarre_a', demarre_a,
    'termine_a', termine_a
  ) INTO v_dernier_import
  FROM public.imports_excel
  WHERE deleted_at IS NULL AND (created_by = v_uid OR organisation_id = v_org)
  ORDER BY demarre_a DESC
  LIMIT 1;

  -- C4 : complétude recommandée = lignes avec TOUTES les infos recommandées
  -- (date_naissance + consentement défini + contacts si consentement)
  SELECT COUNT(*) FILTER (
    WHERE date_naissance IS NOT NULL
      AND consentement_date IS NOT NULL
      AND (consentement_recueilli = FALSE OR (telephone IS NOT NULL OR courriel IS NOT NULL))
  ) INTO v_nb_complets
  FROM public.beneficiaires
  WHERE deleted_at IS NULL AND created_by = v_uid;

  v_taux_completude := CASE
    WHEN v_nb_beneficiaires = 0 THEN 100
    ELSE ROUND(100.0 * v_nb_complets / v_nb_beneficiaires, 1)
  END;

  -- C5 : formulaires à remplir — placeholder V1 (phase 2 : formulaires dynamiques)
  -- Compte les bénéficiaires de mon organisation sans aucune réponse à une enquête
  SELECT COUNT(*) INTO v_formulaires_a_remplir
  FROM public.beneficiaires b
  WHERE b.deleted_at IS NULL
    AND b.organisation_id = v_org
    AND b.consentement_recueilli = TRUE
    AND b.date_fin_formation IS NOT NULL
    AND b.date_fin_formation < NOW() - INTERVAL '5 months'
    AND NOT EXISTS (
      SELECT 1 FROM public.reponses_enquetes r
      WHERE r.beneficiaire_id = b.id AND r.deleted_at IS NULL
    );

  RETURN jsonb_build_object(
    'role', 'contributeur_partenaire',
    'beneficiaires_saisis', v_nb_beneficiaires,
    'dernier_import', COALESCE(v_dernier_import, 'null'::jsonb),
    'completude', jsonb_build_object(
      'valeur', v_taux_completude,
      'numerateur', v_nb_complets,
      'denominateur', v_nb_beneficiaires,
      'alerte', (v_taux_completude < 80 AND v_nb_beneficiaires > 0)
    ),
    'formulaires_a_remplir', v_formulaires_a_remplir
  );
END;
$$;

-- 4. Dashboard lecteur ---------------------------------------------------------
-- Pas de KPI, juste des compteurs de périmètre pour affichage contextuel.
CREATE OR REPLACE FUNCTION public.get_kpis_dashboard_lecteur()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projets TEXT[];
  v_org UUID;
  v_nb_beneficiaires INTEGER;
  v_nb_structures INTEGER;
  v_nb_projets INTEGER;
  v_nb_pays INTEGER;
  v_derniere_maj TIMESTAMPTZ;
BEGIN
  IF public.current_role_metier() <> 'lecteur' THEN
    RETURN jsonb_build_object('erreur', 'acces_refuse');
  END IF;

  v_projets := public.current_projets_geres();
  v_org := public.current_organisation_id();

  -- Bénéficiaires et structures visibles (même logique que policy lecteur)
  SELECT COUNT(*) INTO v_nb_beneficiaires
  FROM public.beneficiaires
  WHERE deleted_at IS NULL
    AND (organisation_id = v_org OR projet_code = ANY(v_projets));

  SELECT COUNT(*) INTO v_nb_structures
  FROM public.structures
  WHERE deleted_at IS NULL
    AND (organisation_id = v_org OR projet_code = ANY(v_projets));

  SELECT COUNT(DISTINCT projet_code) INTO v_nb_projets
  FROM public.beneficiaires
  WHERE deleted_at IS NULL
    AND (organisation_id = v_org OR projet_code = ANY(v_projets));

  SELECT COUNT(DISTINCT pays_code) INTO v_nb_pays
  FROM public.beneficiaires
  WHERE deleted_at IS NULL
    AND (organisation_id = v_org OR projet_code = ANY(v_projets));

  SELECT GREATEST(
    COALESCE((SELECT MAX(updated_at) FROM public.beneficiaires
              WHERE deleted_at IS NULL
                AND (organisation_id = v_org OR projet_code = ANY(v_projets))), NULL),
    COALESCE((SELECT MAX(updated_at) FROM public.structures
              WHERE deleted_at IS NULL
                AND (organisation_id = v_org OR projet_code = ANY(v_projets))), NULL)
  ) INTO v_derniere_maj;

  RETURN jsonb_build_object(
    'role', 'lecteur',
    'beneficiaires_visibles', v_nb_beneficiaires,
    'structures_visibles', v_nb_structures,
    'projets_couverts', v_nb_projets,
    'pays_couverts', v_nb_pays,
    'derniere_maj', v_derniere_maj
  );
END;
$$;

-- 5. Router générique : choisit la bonne fonction selon le rôle courant -------
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
    WHEN 'admin_scs' THEN public.get_kpis_dashboard_admin_scs()
    WHEN 'editeur_projet' THEN public.get_kpis_dashboard_editeur_projet()
    WHEN 'contributeur_partenaire' THEN public.get_kpis_dashboard_contributeur_partenaire()
    WHEN 'lecteur' THEN public.get_kpis_dashboard_lecteur()
    ELSE jsonb_build_object('erreur', 'role_inconnu')
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard_admin_scs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard_editeur_projet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard_contributeur_partenaire TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard_lecteur TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpis_dashboard TO authenticated;
