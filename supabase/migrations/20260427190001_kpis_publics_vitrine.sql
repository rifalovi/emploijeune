-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 024 : KPI publics pour la vitrine
-- -----------------------------------------------------------------------------
-- Sprint 3 (V1.4.0) — Vitrine publique institutionnelle.
--
-- Une fonction `get_kpis_publics_v1()` exposable au rôle `anon` (visiteurs
-- non authentifiés) pour alimenter la page d'accueil publique. Retourne
-- exclusivement des AGRÉGATS — aucune donnée nominative.
--
-- Sécurité :
--   • SECURITY DEFINER → exécution avec les droits du créateur, bypass RLS.
--   • Aucune lecture directe de `beneficiaires` / `structures` côté anon.
--   • La fonction filtre `deleted_at IS NULL` pour exclure les soft-deletes.
--   • GRANT EXECUTE TO anon, authenticated.
--
-- RGPD : compatible « accès libre » — strictement des compteurs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_publics_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_beneficiaires INTEGER;
  v_femmes INTEGER;
  v_hommes INTEGER;
  v_structures INTEGER;
  v_pays INTEGER;
  v_projets INTEGER;
  v_annee_min INTEGER;
  v_annee_max INTEGER;
  v_top_pays JSONB;
  v_femmes_pct INTEGER;
BEGIN
  -- Bénéficiaires : total + ventilation sexe
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sexe = 'F'),
    COUNT(*) FILTER (WHERE sexe = 'M'),
    MIN(annee_formation),
    MAX(annee_formation)
  INTO v_beneficiaires, v_femmes, v_hommes, v_annee_min, v_annee_max
  FROM public.beneficiaires
  WHERE deleted_at IS NULL;

  v_femmes_pct := CASE
    WHEN v_beneficiaires > 0 THEN ROUND(100.0 * v_femmes / v_beneficiaires)::INTEGER
    ELSE 0
  END;

  -- Structures
  SELECT COUNT(*) INTO v_structures
  FROM public.structures WHERE deleted_at IS NULL;

  -- Pays distincts (union bénéficiaires + structures, exclut le code
  -- sentinelle ZZZ « Non spécifié »)
  SELECT COUNT(DISTINCT pays_code) INTO v_pays
  FROM (
    SELECT pays_code FROM public.beneficiaires
    WHERE deleted_at IS NULL AND pays_code IS NOT NULL AND pays_code <> 'ZZZ'
    UNION
    SELECT pays_code FROM public.structures
    WHERE deleted_at IS NULL AND pays_code IS NOT NULL AND pays_code <> 'ZZZ'
  ) t;

  -- Projets distincts
  SELECT COUNT(DISTINCT projet_code) INTO v_projets
  FROM (
    SELECT projet_code FROM public.beneficiaires WHERE deleted_at IS NULL
    UNION
    SELECT projet_code FROM public.structures WHERE deleted_at IS NULL
  ) t;

  -- Top 10 pays (anonyme — agrégats)
  WITH agg AS (
    SELECT pays_code, COUNT(*) AS nb
    FROM public.beneficiaires
    WHERE deleted_at IS NULL AND pays_code IS NOT NULL AND pays_code <> 'ZZZ'
    GROUP BY pays_code
    ORDER BY nb DESC
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.pays_code,
    'libelle', pa.libelle_fr,
    'beneficiaires', a.nb
  ) ORDER BY a.nb DESC), '[]'::jsonb)
  INTO v_top_pays
  FROM agg a LEFT JOIN public.pays pa ON pa.code_iso = a.pays_code;

  RETURN jsonb_build_object(
    'beneficiaires_total', v_beneficiaires,
    'beneficiaires_femmes', v_femmes,
    'beneficiaires_hommes', v_hommes,
    'beneficiaires_femmes_pct', v_femmes_pct,
    'structures_total', v_structures,
    'pays_total', v_pays,
    'projets_actifs', v_projets,
    'annee_couverture_min', v_annee_min,
    'annee_couverture_max', v_annee_max,
    'top_pays', COALESCE(v_top_pays, '[]'::jsonb)
  );
END;
$$;

-- IMPORTANT : exposer la fonction au rôle anon (visiteurs non authentifiés)
GRANT EXECUTE ON FUNCTION public.get_kpis_publics_v1() TO anon, authenticated;

COMMENT ON FUNCTION public.get_kpis_publics_v1 IS
  'KPI publics anonymes pour la vitrine /. Compteurs agrégés uniquement (zéro donnée nominative). Exposable au rôle anon — RGPD compatible.';
