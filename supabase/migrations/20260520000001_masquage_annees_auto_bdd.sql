-- =============================================================================
-- Migration — Masquage d'années pour les indicateurs auto-BDD (A1, B1, B4)
-- -----------------------------------------------------------------------------
-- Problème : A1/B1/B4 sont calculés directement depuis beneficiaires/structures.
-- Il n'existe aucun mécanisme pour masquer une année partielle (ex. 2026 avec
-- seulement 2 bénéficiaires en cours d'année) de la page publique.
--
-- Solution :
--   1) Colonne `annees_masquees INTEGER[]` dans `indicateurs_config`.
--   2) RPC `masquer_annee_indicateur` — toggle masquage (admin_scs/super_admin).
--   3) `lister_indicateurs_avec_valeurs_annuelles` mis à jour :
--        - Non-admins : années masquées filtrées (invisible sur le front)
--        - Admins : toutes les années incluses + flag `masque: true` sur les
--          années cachées (pour que l'UI puisse afficher le bouton Démasquer)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colonne annees_masquees
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.indicateurs_config
  ADD COLUMN IF NOT EXISTS annees_masquees INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.indicateurs_config.annees_masquees IS
  'Années masquées sur la page publique pour les indicateurs auto-BDD (A1, B1, B4).
   Tableau vide = aucune année masquée. Les admins voient toujours toutes les années.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC masquer_annee_indicateur
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.masquer_annee_indicateur(
  p_code    TEXT,
  p_annee   INTEGER,
  p_masquer BOOLEAN
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
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT (public.is_admin_scs() OR public.current_role_metier() = 'super_admin') THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin_scs');
  END IF;

  -- Seuls A1, B1, B4 supportent le masquage (les autres ont publie=TRUE/FALSE)
  IF p_code NOT IN ('A1', 'B1', 'B4') THEN
    RETURN jsonb_build_object('erreur', 'masquage_non_supporte', 'code', p_code,
      'detail', 'Seuls A1, B1 et B4 (calcul auto-BDD) supportent le masquage par année.');
  END IF;

  IF p_masquer THEN
    -- Ajouter l'année si elle n'est pas déjà dans le tableau
    UPDATE public.indicateurs_config
    SET annees_masquees = array_append(
          annees_masquees,
          p_annee
        )
    WHERE indicateur_code = p_code
      AND NOT (p_annee = ANY(annees_masquees));
  ELSE
    -- Retirer l'année du tableau
    UPDATE public.indicateurs_config
    SET annees_masquees = array_remove(annees_masquees, p_annee)
    WHERE indicateur_code = p_code;
  END IF;

  RETURN jsonb_build_object(
    'succes', TRUE,
    'code',   p_code,
    'annee',  p_annee,
    'masque', p_masquer
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.masquer_annee_indicateur(TEXT, INTEGER, BOOLEAN)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. lister_indicateurs_avec_valeurs_annuelles — masquage A1 / B1 / B4
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lister_indicateurs_avec_valeurs_annuelles()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID;
  v_role            public.role_utilisateur;
  v_voit_brouillons BOOLEAN;
  v_projets         TEXT[];
  v_resultat        JSONB := '[]'::JSONB;
  v_annee_min       INTEGER := 2020;
  v_annee_max       INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  -- Années masquées par indicateur auto-BDD
  v_masq_a1         INTEGER[];
  v_masq_b1         INTEGER[];
  v_masq_b4         INTEGER[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;
  IF v_role IS NULL THEN RETURN jsonb_build_object('erreur', 'pas_de_profil'); END IF;

  v_voit_brouillons := (v_role IN ('super_admin', 'admin_scs'));
  v_projets := public.current_projets_geres();

  -- Charger les années masquées pour A1, B1, B4
  SELECT COALESCE(annees_masquees, '{}')
  INTO v_masq_a1
  FROM public.indicateurs_config WHERE indicateur_code = 'A1';
  v_masq_a1 := COALESCE(v_masq_a1, '{}');

  SELECT COALESCE(annees_masquees, '{}')
  INTO v_masq_b1
  FROM public.indicateurs_config WHERE indicateur_code = 'B1';
  v_masq_b1 := COALESCE(v_masq_b1, '{}');

  SELECT COALESCE(annees_masquees, '{}')
  INTO v_masq_b4
  FROM public.indicateurs_config WHERE indicateur_code = 'B4';
  v_masq_b4 := COALESCE(v_masq_b4, '{}');

  -- ──── A1 — Effectifs bénéficiaires ───────────────────────────────────
  -- Admins : toutes années + flag masque
  -- Non-admins : années masquées filtrées
  WITH valeurs AS (
    SELECT
      b.annee_formation                                        AS annee,
      COUNT(*)::INTEGER                                        AS valeur,
      COUNT(*) FILTER (WHERE b.sexe = 'F')::INTEGER           AS femmes,
      COUNT(*) FILTER (WHERE b.sexe = 'M')::INTEGER           AS hommes,
      (b.annee_formation = ANY(v_masq_a1))                    AS masque
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
      -- Filtre masquage : admins voient tout, public ne voit pas les masquées
      AND (v_voit_brouillons OR NOT (b.annee_formation = ANY(v_masq_a1)))
    GROUP BY b.annee_formation
    ORDER BY b.annee_formation
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', valeur,
      'femmes', femmes,
      'hommes', hommes,
      'source', 'auto',
      'masque', masque
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs WHERE NOT masque)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee  FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── A2 — Taux d'achèvement (BDD prioritaire, saisies en fallback) ──
  WITH auto AS (
    SELECT
      b.annee_formation AS annee,
      COUNT(*)::INTEGER AS denominateur_auto,
      COUNT(*) FILTER (WHERE b.statut_code = 'FORMATION_ACHEVEE')::INTEGER AS numerateur_auto
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
    GROUP BY b.annee_formation
  ),
  saisies AS (
    SELECT annee, numerateur AS num_saisi, denominateur AS denom_saisi
    FROM public.valeurs_indicateurs_saisies
    WHERE indicateur_code = 'A2'
      AND (v_voit_brouillons OR publie = TRUE)
  ),
  fusion AS (
    SELECT
      COALESCE(a.annee, s.annee) AS annee,
      COALESCE(a.numerateur_auto, s.num_saisi) AS numerateur,
      COALESCE(a.denominateur_auto, s.denom_saisi) AS denominateur,
      CASE
        WHEN a.numerateur_auto IS NOT NULL AND a.denominateur_auto IS NOT NULL THEN 'auto'
        WHEN (a.numerateur_auto IS NULL AND s.num_saisi IS NOT NULL)
          OR (a.denominateur_auto IS NULL AND s.denom_saisi IS NOT NULL)
          AND (a.numerateur_auto IS NOT NULL OR a.denominateur_auto IS NOT NULL) THEN 'mixte'
        ELSE 'saisie'
      END AS source
    FROM auto a FULL OUTER JOIN saisies s ON a.annee = s.annee
  ),
  valeurs AS (
    SELECT * FROM fusion
    WHERE annee BETWEEN v_annee_min AND v_annee_max
      AND denominateur IS NOT NULL AND denominateur >= 5
    ORDER BY annee
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A2',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1),
      'numerateur', numerateur,
      'denominateur', denominateur,
      'source', source
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1) FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B1 — Structures économiques appuyées ───────────────────────────
  WITH valeurs AS (
    SELECT
      s.annee_appui                                            AS annee,
      COUNT(*)::INTEGER                                        AS valeur,
      COUNT(*) FILTER (WHERE s.statut_creation = 'creation')::INTEGER    AS creation,
      COUNT(*) FILTER (WHERE s.statut_creation = 'renforcement')::INTEGER AS renforcement,
      (s.annee_appui = ANY(v_masq_b1))                        AS masque
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
      AND (v_voit_brouillons OR NOT (s.annee_appui = ANY(v_masq_b1)))
    GROUP BY s.annee_appui
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', valeur,
      'creation', creation,
      'renforcement', renforcement,
      'source', 'auto',
      'masque', masque
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs WHERE NOT masque)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee  FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B4 — Volume d'appui financier ──────────────────────────────────
  WITH valeurs AS (
    SELECT
      s.annee_appui                                            AS annee,
      ROUND(SUM(COALESCE(s.montant_appui, 0))::NUMERIC, 0)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.montant_appui IS NOT NULL)::INTEGER AS nb_avec_montant,
      (s.annee_appui = ANY(v_masq_b4))                        AS masque
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
      AND (v_voit_brouillons OR NOT (s.annee_appui = ANY(v_masq_b4)))
    GROUP BY s.annee_appui
    HAVING SUM(COALESCE(s.montant_appui, 0)) > 0
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B4',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', valeur,
      'nb_avec_montant', nb_avec_montant,
      'source', 'auto',
      'masque', masque
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs WHERE NOT masque)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee  FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── Indicateurs non auto-mesurables ────────────────────────────────
  v_resultat := v_resultat || jsonb_build_array(
    lister_indicateur_non_auto('A3', 'Nécessite données certification/attestation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A4', 'Nécessite scores avant/après formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A5', 'Nécessite suivi 6/12 mois post-formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B2', 'Nécessite suivi structures 12/24 mois (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B3', 'Nécessite déclaration emplois créés (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('C1', 'Pas encore de collecte sur les demandes d''accompagnement.', v_voit_brouillons),
    lister_indicateur_non_auto('C2', 'Pas encore de collecte sur les mises en relation.', v_voit_brouillons),
    lister_indicateur_non_auto('C3', 'Pas encore de collecte sur les partenariats économiques.', v_voit_brouillons),
    lister_indicateur_non_auto('C4', 'Pas encore de collecte.', v_voit_brouillons),
    lister_indicateur_non_auto('C5', 'Pas encore de collecte.', v_voit_brouillons),
    lister_indicateur_non_auto('D1', 'Nécessite suivi politiques publiques (collecte qualitative).', v_voit_brouillons),
    lister_indicateur_non_auto('D2', 'Nécessite suivi réformes adoptées.', v_voit_brouillons),
    lister_indicateur_non_auto('D3', 'Nécessite suivi adoption recommandations.', v_voit_brouillons),
    lister_indicateur_non_auto('F1', 'Nécessite question dédiée sur l''apport du français (enquête F).', v_voit_brouillons)
  );

  RETURN jsonb_build_object(
    'role',       v_role,
    'annee_min',  v_annee_min,
    'annee_max',  v_annee_max,
    'indicateurs', v_resultat
  );
END;
$$;
