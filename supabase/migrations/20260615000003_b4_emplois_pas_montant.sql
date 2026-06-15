-- =============================================================================
-- Migration 20260615000003 — B4 = emplois (valeur saisie), PAS un montant €
-- -----------------------------------------------------------------------------
-- Constat : B4 « Emplois indirects (estimés) » était calculé comme
-- SUM(montant_appui) (héritage « Volume d'appui ») → affiché en € (ex.
-- 7 332 252 € / 174,6 M€) sous un libellé d'emplois. Incohérent.
--
-- Correctif : B4 devient un indicateur SAISI (comme B3) → il prend la dernière
-- valeur saisie/publiée (ex. 1 464 emplois), au lieu de la somme des montants.
--
-- En complément (vitrine publique) : A2/A3/A5 prennent le taux num/dénom s'il
-- existe, SINON la valeur directe saisie (vos valeurs 2026 sont en valeur
-- directe) ; et on ne montre publiquement que les saisies PUBLIÉES.
--
-- Fonctions read-only (STABLE) : en cas d'erreur de syntaxe, le CREATE OR
-- REPLACE échoue et l'ancienne version reste en place (aucune casse).
-- =============================================================================

-- 1) Vitrine publique ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_indicateurs_vitrine_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultat JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY ordre_val), '[]'::JSONB)
  INTO v_resultat
  FROM (
    SELECT
      c.ordre AS ordre_val,
      jsonb_build_object(
        'code',   c.indicateur_code,
        'ordre',  c.ordre,
        'valeur', (
          CASE c.indicateur_code

            -- A1 : total bénéficiaires (cumulatif toutes années)
            WHEN 'A1' THEN (
              SELECT COUNT(*)::NUMERIC
              FROM public.beneficiaires
              WHERE deleted_at IS NULL
            )

            -- B1 : total structures (cumulatif toutes années)
            WHEN 'B1' THEN (
              SELECT COUNT(*)::NUMERIC
              FROM public.structures
              WHERE deleted_at IS NULL
            )

            -- A2, A3, A5 : TAUX (%). Taux = 100*num/dénom si disponible,
            --   sinon valeur directe saisie. Seules les saisies PUBLIÉES.
            WHEN 'A2' THEN (
              SELECT COALESCE(
                ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1),
                v.valeur_directe
              )
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A2' AND v.publie = TRUE
              ORDER BY v.annee DESC
              LIMIT 1
            )
            WHEN 'A3' THEN (
              SELECT COALESCE(
                ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1),
                v.valeur_directe
              )
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A3' AND v.publie = TRUE
              ORDER BY v.annee DESC
              LIMIT 1
            )
            WHEN 'A5' THEN (
              SELECT COALESCE(
                ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1),
                v.valeur_directe
              )
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A5' AND v.publie = TRUE
              ORDER BY v.annee DESC
              LIMIT 1
            )

            -- Autres indicateurs (dont B4) : dernière valeur saisie PUBLIÉE
            --   (effectif). B4 = emplois indirects, plus jamais un montant.
            ELSE (
              SELECT COALESCE(v.valeur_directe, v.numerateur)::NUMERIC
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = c.indicateur_code AND v.publie = TRUE
              ORDER BY v.annee DESC
              LIMIT 1
            )

          END
        )
      ) AS item
    FROM public.config_vitrine_indicateurs c
    WHERE c.visible = TRUE
  ) sub;

  RETURN v_resultat;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_vitrine_v1() TO anon, authenticated;

COMMENT ON FUNCTION public.get_indicateurs_vitrine_v1 IS
  'Vitrine publique. A2/A3/A5 = taux (num/dénom) sinon valeur directe. B4 = emplois saisis (plus de montant). Saisies publiées uniquement.';

-- 2) Indicateurs annuels (admin /indicateurs) --------------------------------
--    B4 passe d'un calcul auto (SUM montant) à un indicateur SAISI (comme B3).
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
  v_masq_a1         INTEGER[];
  v_masq_b1         INTEGER[];
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

  SELECT COALESCE(annees_masquees, '{}') INTO v_masq_a1
  FROM public.indicateurs_config WHERE indicateur_code = 'A1';
  v_masq_a1 := COALESCE(v_masq_a1, '{}');

  SELECT COALESCE(annees_masquees, '{}') INTO v_masq_b1
  FROM public.indicateurs_config WHERE indicateur_code = 'B1';
  v_masq_b1 := COALESCE(v_masq_b1, '{}');

  -- ──── A1 — Effectifs bénéficiaires ───────────────────────────────────
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
      AND (v_voit_brouillons OR NOT (b.annee_formation = ANY(v_masq_a1)))
    GROUP BY b.annee_formation
    ORDER BY b.annee_formation
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'femmes', femmes, 'hommes', hommes,
      'source', 'auto', 'masque', masque
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
      'numerateur', numerateur, 'denominateur', denominateur, 'source', source
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
      'annee', annee, 'valeur', valeur, 'creation', creation,
      'renforcement', renforcement, 'source', 'auto', 'masque', masque
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs WHERE NOT masque)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee  FROM valeurs WHERE NOT masque ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── Indicateurs non auto-mesurables (B4 inclus désormais) ──────────
  v_resultat := v_resultat || jsonb_build_array(
    lister_indicateur_non_auto('A3', 'Nécessite données certification/attestation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A4', 'Nécessite scores avant/après formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A5', 'Nécessite suivi 6/12 mois post-formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B2', 'Nécessite suivi structures 12/24 mois (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B3', 'Nécessite déclaration emplois créés (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B4', 'Emplois indirects estimés (déclaratif / rapport d''enquête).', v_voit_brouillons),
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

GRANT EXECUTE ON FUNCTION public.lister_indicateurs_avec_valeurs_annuelles() TO authenticated;
