-- =============================================================================
-- Migration 20260531000015 — Phase 4.1 : RPC qualite des donnees
-- -----------------------------------------------------------------------------
-- Pourquoi : fournir un endpoint unique pour le dashboard qualite. Retourne
--   pour chaque champ critique : total, complets, pct, alertes ouvertes.
--   Calcul a la volee (pas de cache) pour garantir la fraicheur.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_indicateurs_qualite_donnees_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total      BIGINT;
  v_resultat   JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.beneficiaires WHERE deleted_at IS NULL;

  IF v_total = 0 THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT jsonb_agg(item ORDER BY ordre) INTO v_resultat
  FROM (
    -- Tranche d'age
    SELECT 1 AS ordre, jsonb_build_object(
      'champ', 'tranche_age',
      'libelle', 'Tranche d''âge',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL AND tranche_age_declaree IS NOT NULL),
      'alertes_ouvertes', (SELECT COUNT(*) FROM public.alertes_qualite
                           WHERE type = 'tranche_age_null' AND statut = 'ouvert')
    ) AS item

    UNION ALL

    -- Pays valide (ni NULL ni ZZZ)
    SELECT 2, jsonb_build_object(
      'champ', 'pays',
      'libelle', 'Pays valide',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL
                     AND pays_code IS NOT NULL
                     AND pays_code <> 'ZZZ'),
      'alertes_ouvertes', (SELECT COUNT(*) FROM public.alertes_qualite
                           WHERE type IN ('pays_zzz', 'pays_null') AND statut = 'ouvert')
    )

    UNION ALL

    -- Sexe
    SELECT 3, jsonb_build_object(
      'champ', 'sexe',
      'libelle', 'Sexe',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL AND sexe IS NOT NULL),
      'alertes_ouvertes', 0
    )

    UNION ALL

    -- Annee formation (= annee appui)
    SELECT 4, jsonb_build_object(
      'champ', 'annee_formation',
      'libelle', 'Année d''appui',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL AND annee_formation IS NOT NULL),
      'alertes_ouvertes', 0
    )

    UNION ALL

    -- Date de naissance
    SELECT 5, jsonb_build_object(
      'champ', 'date_naissance',
      'libelle', 'Date de naissance',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL AND date_naissance IS NOT NULL),
      'alertes_ouvertes', 0
    )

    UNION ALL

    -- Domaine de formation
    SELECT 6, jsonb_build_object(
      'champ', 'domaine_formation',
      'libelle', 'Domaine de formation',
      'total', v_total,
      'complets', (SELECT COUNT(*) FROM public.beneficiaires
                   WHERE deleted_at IS NULL AND domaine_formation_code IS NOT NULL),
      'alertes_ouvertes', 0
    )
  ) sub;

  RETURN COALESCE(v_resultat, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_qualite_donnees_v1() TO authenticated;

-- ── Top 5 projets defaillants ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_projets_defaillants_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultat JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY pct_complete ASC), '[]'::JSONB)
  INTO v_resultat
  FROM (
    SELECT jsonb_build_object(
      'projet_code', b.projet_code,
      'total', COUNT(*),
      'tranche_ok', COUNT(*) FILTER (WHERE b.tranche_age_declaree IS NOT NULL),
      'pays_ok', COUNT(*) FILTER (WHERE b.pays_code IS NOT NULL AND b.pays_code <> 'ZZZ'),
      'pct_complete', ROUND(
        100.0 * LEAST(
          COUNT(*) FILTER (WHERE b.tranche_age_declaree IS NOT NULL),
          COUNT(*) FILTER (WHERE b.pays_code IS NOT NULL AND b.pays_code <> 'ZZZ')
        ) / NULLIF(COUNT(*), 0),
        1
      ),
      'alertes_ouvertes', (
        SELECT COUNT(*) FROM public.alertes_qualite a
        WHERE a.projet_code = b.projet_code AND a.statut = 'ouvert'
      )
    ) AS item,
    ROUND(
      100.0 * LEAST(
        COUNT(*) FILTER (WHERE b.tranche_age_declaree IS NOT NULL),
        COUNT(*) FILTER (WHERE b.pays_code IS NOT NULL AND b.pays_code <> 'ZZZ')
      ) / NULLIF(COUNT(*), 0),
      1
    ) AS pct_complete
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
    GROUP BY b.projet_code
    HAVING ROUND(
      100.0 * LEAST(
        COUNT(*) FILTER (WHERE b.tranche_age_declaree IS NOT NULL),
        COUNT(*) FILTER (WHERE b.pays_code IS NOT NULL AND b.pays_code <> 'ZZZ')
      ) / NULLIF(COUNT(*), 0),
      1
    ) < 100
    LIMIT 5
  ) sub;

  RETURN v_resultat;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projets_defaillants_v1() TO authenticated;
