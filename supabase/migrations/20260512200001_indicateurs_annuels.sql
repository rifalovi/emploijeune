-- =============================================================================
-- Migration — Page « Tous les indicateurs » : RPC d'agrégation annuelle
-- -----------------------------------------------------------------------------
-- Fournit une vue par année (2020 → année courante) des 18 indicateurs CMR.
-- Réutilise les tables existantes pour les indicateurs calculables ; les
-- autres sont marqués 'non_mesurable' avec un message explicatif (collecte
-- d'enquêtes A/B/F pas encore opérationnelle).
--
-- À terme (V2) : table snapshot pour cache + cron de pré-calcul. En V1, on
-- calcule à la volée depuis les tables sources (≤5000 lignes, OK perf).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table de configuration des indicateurs (toggle visualisation)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.indicateurs_config (
  indicateur_code  TEXT PRIMARY KEY,
  visu_activee     BOOLEAN NOT NULL DEFAULT FALSE,
  /** TRUE = la visualisation graphique est forcée même avec < 2 années. */
  visu_forcee      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.indicateurs_config IS
  'Configuration par indicateur : toggle d''activation de la visualisation graphique. La règle par défaut est : activée si ≥ 2 années de collecte. Le super_admin peut surcharger via `visu_forcee`.';

-- Seed initial : tous les codes des 18 indicateurs CMR
INSERT INTO public.indicateurs_config (indicateur_code, visu_activee, visu_forcee)
VALUES
  ('A1', FALSE, FALSE), ('A2', FALSE, FALSE), ('A3', FALSE, FALSE),
  ('A4', FALSE, FALSE), ('A5', FALSE, FALSE),
  ('B1', FALSE, FALSE), ('B2', FALSE, FALSE), ('B3', FALSE, FALSE),
  ('B4', FALSE, FALSE),
  ('C1', FALSE, FALSE), ('C2', FALSE, FALSE), ('C3', FALSE, FALSE),
  ('C4', FALSE, FALSE), ('C5', FALSE, FALSE),
  ('D1', FALSE, FALSE), ('D2', FALSE, FALSE), ('D3', FALSE, FALSE),
  ('F1', FALSE, FALSE)
ON CONFLICT (indicateur_code) DO NOTHING;

-- RLS : lecture authentifiée, écriture super_admin uniquement
ALTER TABLE public.indicateurs_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY indicateurs_config_read ON public.indicateurs_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY indicateurs_config_update ON public.indicateurs_config
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT ALL ON public.indicateurs_config TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC : lister_indicateurs_avec_valeurs_annuelles()
-- ─────────────────────────────────────────────────────────────────────────────
-- Retourne pour CHAQUE indicateur (les 18) :
--   - code, libelle, pilier, definition
--   - statut_calcul : 'calcule' | 'non_mesurable' | 'pas_de_donnees'
--   - mention : pourquoi non mesurable le cas échéant
--   - visu_activee, visu_forcee (depuis indicateurs_config)
--   - valeurs_par_annee : array de { annee, valeur, numerateur, denominateur }
--   - nb_annees_avec_donnees
--   - derniere_valeur, derniere_annee (pour l'affichage en liste)
-- ─────────────────────────────────────────────────────────────────────────────

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
    HAVING COUNT(*) >= 5  -- seuil minimum pour qu'un taux soit pertinent
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
  WITH valeurs AS (
    SELECT
      s.annee_appui AS annee,
      ROUND(SUM(COALESCE(s.montant_appui_eur, 0))::NUMERIC, 0)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.montant_appui_eur IS NOT NULL)::INTEGER AS nb_avec_montant
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
    GROUP BY s.annee_appui
    HAVING SUM(COALESCE(s.montant_appui_eur, 0)) > 0
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
  -- A3, A4, A5, B2, B3, C1-C5, D1-D3, F1 : nécessitent collecte d'enquêtes
  --  (A/B/F) qui n'est pas encore opérationnelle. On les inclut comme
  -- 'non_mesurable' pour visibilité dans la page admin.

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

GRANT EXECUTE ON FUNCTION public.lister_indicateurs_avec_valeurs_annuelles() TO authenticated;

COMMENT ON FUNCTION public.lister_indicateurs_avec_valeurs_annuelles IS
  'Retourne les 18 indicateurs CMR avec leurs valeurs annuelles. Calculé à la volée pour A1/A2/B1/B4, marqué non_mesurable pour les autres (collecte enquêtes pas opérationnelle en V1).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC : toggle_indicateur_visu(p_code, p_forcee, p_valeur)
-- ─────────────────────────────────────────────────────────────────────────────
-- Permet au super_admin de forcer l'activation/désactivation d'un indicateur.
-- Sans cette action, la règle automatique s'applique : visu auto si ≥ 2
-- années de données.

CREATE OR REPLACE FUNCTION public.toggle_indicateur_visu(
  p_code TEXT,
  p_visu_forcee BOOLEAN,
  p_valeur BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  UPDATE public.indicateurs_config
  SET visu_forcee = p_visu_forcee,
      visu_activee = p_valeur,
      updated_at = NOW(),
      updated_by = v_uid
  WHERE indicateur_code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'indicateur_inconnu', 'code', p_code);
  END IF;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'visu_activee', p_valeur);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_indicateur_visu(TEXT, BOOLEAN, BOOLEAN) TO authenticated;
