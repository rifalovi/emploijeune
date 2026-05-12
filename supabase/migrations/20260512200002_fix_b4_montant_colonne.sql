-- =============================================================================
-- Hotfix migration 20260512200001 — colonne montant_appui (pas _eur)
-- -----------------------------------------------------------------------------
-- La migration précédente référençait `s.montant_appui_eur` qui n'existe pas
-- sur la table `structures` (colonne réelle : `montant_appui` numeric, avec
-- devise séparée dans `devise_code`). La RPC plantait donc avec une erreur
-- 42703 column does not exist, ce qui faisait que /indicateurs affichait
-- "Impossible de charger les indicateurs".
--
-- Ce fix réécrit la RPC avec le bon nom de colonne. Aucune autre logique
-- ne change. La conversion EUR ↔ FCFA n'est pas faite ici (V1 simplifié :
-- on agrège le `montant_appui` brut, peu importe la devise — la majorité
-- des structures OIF étant en EUR/XOF/XAF, la valeur a un sens mais peut
-- contenir des conversions naïves entre devises).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lister_indicateurs_avec_valeurs_annuelles()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role public.role_utilisateur;
  v_projets TEXT[];
  v_resultat JSONB := '[]'::JSONB;
  v_annee_min INTEGER := 2020;
  v_annee_max INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;
  IF v_role IS NULL THEN RETURN jsonb_build_object('erreur', 'pas_de_profil'); END IF;

  v_projets := public.current_projets_geres();

  -- ──── A1 — Effectifs bénéficiaires ────────────────────────────────────
  WITH valeurs AS (
    SELECT
      b.annee_formation AS annee,
      COUNT(*)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE b.sexe = 'F')::INTEGER AS femmes,
      COUNT(*) FILTER (WHERE b.sexe = 'M')::INTEGER AS hommes
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
    GROUP BY b.annee_formation
    ORDER BY b.annee_formation
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'femmes', femmes, 'hommes', hommes
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── A2 — Taux d'achèvement de la formation ─────────────────────────
  WITH valeurs AS (
    SELECT
      b.annee_formation AS annee,
      COUNT(*)::INTEGER AS denominateur,
      COUNT(*) FILTER (WHERE b.statut_code = 'FORMATION_ACHEVEE')::INTEGER AS numerateur
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
    GROUP BY b.annee_formation
    HAVING COUNT(*) >= 5
    ORDER BY b.annee_formation
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A2',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1),
      'numerateur', numerateur,
      'denominateur', denominateur
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1) FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B1 — Structures économiques appuyées ───────────────────────────
  WITH valeurs AS (
    SELECT
      s.annee_appui AS annee,
      COUNT(*)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.statut_creation = 'creation')::INTEGER AS creation,
      COUNT(*) FILTER (WHERE s.statut_creation = 'renforcement')::INTEGER AS renforcement
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
    GROUP BY s.annee_appui
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'creation', creation, 'renforcement', renforcement
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B4 — Volume d'appui économique ─────────────────────────────────
  -- Colonne réelle : `montant_appui` (numeric). Devise côté `devise_code`
  -- non utilisée en V1 (conversion à faire en V2 si besoin).
  WITH valeurs AS (
    SELECT
      s.annee_appui AS annee,
      ROUND(SUM(COALESCE(s.montant_appui, 0))::NUMERIC, 0)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.montant_appui IS NOT NULL)::INTEGER AS nb_avec_montant
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
    GROUP BY s.annee_appui
    HAVING SUM(COALESCE(s.montant_appui, 0)) > 0
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B4',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'nb_avec_montant', nb_avec_montant
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── Indicateurs non encore mesurables (V1) ─────────────────────────
  v_resultat := v_resultat
    || jsonb_build_array(
      jsonb_build_object('code', 'A3', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite données certification/attestation (enquête A V2).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'A4', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite scores avant/après formation (enquête A V2).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'A5', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite suivi 6/12 mois post-formation (enquête A V2).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'B2', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite suivi structures 12/24 mois (enquête B V2).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'B3', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite déclaration emplois créés (enquête B V2).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'C1', 'statut_calcul', 'non_mesurable',
        'mention', 'Pas encore de collecte sur les demandes d''accompagnement.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'C2', 'statut_calcul', 'non_mesurable',
        'mention', 'Pas encore de collecte sur les mises en relation.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'C3', 'statut_calcul', 'non_mesurable',
        'mention', 'Pas encore de collecte sur les partenariats économiques.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'C4', 'statut_calcul', 'non_mesurable',
        'mention', 'Pas encore de collecte.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'C5', 'statut_calcul', 'non_mesurable',
        'mention', 'Pas encore de collecte.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'D1', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite suivi politiques publiques (collecte qualitative).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'D2', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite suivi réformes adoptées.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'D3', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite suivi adoption recommandations.',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null),
      jsonb_build_object('code', 'F1', 'statut_calcul', 'non_mesurable',
        'mention', 'Nécessite question dédiée sur l''apport du français (enquête F).',
        'valeurs_par_annee', '[]'::JSONB, 'nb_annees_avec_donnees', 0,
        'derniere_valeur', null, 'derniere_annee', null)
    );

  RETURN jsonb_build_object(
    'role', v_role,
    'annee_min', v_annee_min,
    'annee_max', v_annee_max,
    'indicateurs', v_resultat
  );
END;
$$;
