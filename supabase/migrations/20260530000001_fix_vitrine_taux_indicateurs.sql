-- =============================================================================
-- Fix migration 20260530000001 — Vitrine : calcul correct des taux (A2, A3, A5)
-- -----------------------------------------------------------------------------
-- Avant : la RPC `get_indicateurs_vitrine_v1()` retournait pour A5 le numérateur
--         brut (ex. 1 100 personnes insérées) au lieu du taux d'insertion.
--         L'utilisateur voyait « 1 100 » sous le libellé « TAUX D'INSERTION
--         PROFESSIONNELLE À 6/12 MOIS » — incohérent.
--
-- Après : pour les indicateurs de type taux (A2 taux d'achèvement,
--         A3 taux de certification, A5 taux d'insertion), la RPC calcule
--         ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1).
--         Si le denominateur est absent ou nul → NULL (la carte affichera "—").
-- =============================================================================

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

            -- B4 : volume d'appui économique cumulatif — ROUND pour éliminer
            --      les décimales (ex. 16 179 538,22 → 16 179 538)
            WHEN 'B4' THEN (
              SELECT ROUND(COALESCE(SUM(montant_appui), 0))::NUMERIC
              FROM public.structures
              WHERE deleted_at IS NULL
            )

            -- A2, A3, A5 : indicateurs de type TAUX (en %)
            --   taux = 100 * numerateur / denominateur, arrondi à 1 décimale.
            --   Si denominateur manquant ou nul → NULL (affichage "—").
            --   Le code est hardcodé (pas de corrélation `c`) pour éviter
            --   les problèmes de portée dans certaines versions de Postgres
            --   quand la sous-requête est imbriquée dans jsonb_build_object.
            WHEN 'A2' THEN (
              SELECT ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1)
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A2'
                AND v.numerateur IS NOT NULL
                AND v.denominateur IS NOT NULL
                AND v.denominateur > 0
              ORDER BY v.annee DESC
              LIMIT 1
            )
            WHEN 'A3' THEN (
              SELECT ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1)
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A3'
                AND v.numerateur IS NOT NULL
                AND v.denominateur IS NOT NULL
                AND v.denominateur > 0
              ORDER BY v.annee DESC
              LIMIT 1
            )
            WHEN 'A5' THEN (
              SELECT ROUND(100.0 * v.numerateur / NULLIF(v.denominateur, 0), 1)
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = 'A5'
                AND v.numerateur IS NOT NULL
                AND v.denominateur IS NOT NULL
                AND v.denominateur > 0
              ORDER BY v.annee DESC
              LIMIT 1
            )

            -- Autres indicateurs : dernière valeur saisie manuellement
            --   (effectif ou montant — pas de calcul de ratio)
            ELSE (
              SELECT COALESCE(v.valeur_directe, v.numerateur)::NUMERIC
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = c.indicateur_code
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
  'Valeurs agrégées pour la vitrine publique. A2/A3/A5 = taux calculé (100*num/denom). B4 = ROUND(SUM(montant_appui)). Zéro donnée nominative.';
