-- =============================================================================
-- Fix migration 20260521000001 — Vitrine B4 : arrondi du montant cumulatif
-- -----------------------------------------------------------------------------
-- B4 « Volume d'appui économique » est un indicateur cumulatif (toutes années).
-- Le seul problème était l'absence de ROUND() → affichage "16 179 538,22".
-- Ce fix ajoute ROUND() sans changer la logique métier (pas de filtre année).
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

            -- Autres indicateurs : dernière valeur saisie manuellement
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
  'Valeurs agrégées pour la vitrine publique. B4 = ROUND(SUM(montant_appui)) cumulatif. Zéro donnée nominative.';
