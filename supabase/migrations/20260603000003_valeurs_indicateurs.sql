-- =============================================================================
-- valeurs_indicateurs — snapshot calculé / publié des indicateurs OIF
-- + RPC calculer_indicateurs_live_v1 + publier_indicateurs_v1
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.valeurs_indicateurs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  indicateur_code  TEXT        NOT NULL,
  valeur_numerique NUMERIC,
  valeur_detail    JSONB,
  periode          TEXT        NOT NULL DEFAULT 'global',
  calculee_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  publiee_at       TIMESTAMPTZ,
  publiee_par      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_valeur_indicateur_periode UNIQUE (indicateur_code, periode)
);

COMMENT ON TABLE public.valeurs_indicateurs IS
  'Valeurs calculées et publiées des indicateurs OIF — gérées via /collecte-analytique/indicateurs';

ALTER TABLE public.valeurs_indicateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vi_read_all    ON public.valeurs_indicateurs FOR SELECT USING (true);
CREATE POLICY vi_write_admin ON public.valeurs_indicateurs FOR ALL    USING (public.is_admin_scs());

-- =============================================================================
-- calculer_indicateurs_live_v1 — retourne toutes les valeurs calculables
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculer_indicateurs_live_v1()
RETURNS TABLE (
  indicateur_code  TEXT,
  valeur_numerique NUMERIC,
  valeur_detail    JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_total_benef  BIGINT := 0;
  v_femmes       BIGINT := 0;
  v_hommes       BIGINT := 0;
  v_total_struct BIGINT := 0;
  v_emplois      BIGINT := 0;
BEGIN

  -- ── A1 : Bénéficiaires formés ─────────────────────────────────────────
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sexe = 'F'),
    COUNT(*) FILTER (WHERE sexe = 'M')
  INTO v_total_benef, v_femmes, v_hommes
  FROM public.beneficiaires WHERE deleted_at IS NULL;

  RETURN QUERY SELECT
    'A1'::TEXT,
    v_total_benef::NUMERIC,
    jsonb_build_object(
      'total',       v_total_benef,
      'femmes',      v_femmes,
      'hommes',      v_hommes,
      'taux_femmes', CASE WHEN v_total_benef > 0
                       THEN ROUND((v_femmes * 100.0 / v_total_benef)::NUMERIC, 1)
                       ELSE 0 END
    );

  -- ── B1 : Structures / AGR appuyées ───────────────────────────────────
  SELECT COUNT(*) INTO v_total_struct
  FROM public.structures WHERE deleted_at IS NULL;

  RETURN QUERY SELECT
    'B1'::TEXT,
    v_total_struct::NUMERIC,
    jsonb_build_object('total', v_total_struct);

  -- ── B3 : Emplois créés ou maintenus ──────────────────────────────────
  SELECT COALESCE(SUM(emplois_crees), 0) INTO v_emplois
  FROM public.structures WHERE deleted_at IS NULL;

  RETURN QUERY SELECT
    'B3'::TEXT,
    v_emplois::NUMERIC,
    jsonb_build_object('emplois_crees', v_emplois);

  -- ── C1 : Mises en relation ────────────────────────────────────────────
  RETURN QUERY SELECT
    'C1'::TEXT,
    COUNT(*)::NUMERIC,
    jsonb_build_object('total', COUNT(*))
  FROM public.reponses_enquetes
  WHERE indicateur_code = 'C1' AND deleted_at IS NULL;

  -- ── Autres : comptage de réponses disponibles ─────────────────────────
  -- Taux réel calculable une fois suffisamment de réponses de suivi collectées.
  RETURN QUERY
    SELECT
      re.indicateur_code,
      COUNT(*)::NUMERIC,
      jsonb_build_object(
        'nb_reponses', COUNT(*),
        'source',      'reponses_enquetes'
      )
    FROM public.reponses_enquetes re
    WHERE re.indicateur_code IN (
      'A2','A3','A4','A5','B2','B4','C2','C3','C4','C5','D1','D2','D3','F1'
    )
      AND re.deleted_at IS NULL
    GROUP BY re.indicateur_code;

END;
$$;

GRANT EXECUTE ON FUNCTION public.calculer_indicateurs_live_v1() TO authenticated;

-- =============================================================================
-- publier_indicateurs_v1 — upsert dans valeurs_indicateurs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.publier_indicateurs_v1(p_codes TEXT[])
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_uid UUID;
  v_cnt INTEGER := 0;
  v_rec RECORD;
BEGIN
  SELECT id INTO v_uid FROM public.utilisateurs
  WHERE id = auth.uid()
    AND role IN ('admin_scs','super_admin')
    AND deleted_at IS NULL;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Accès non autorisé'; END IF;

  FOR v_rec IN
    SELECT indicateur_code, valeur_numerique, valeur_detail
    FROM public.calculer_indicateurs_live_v1()
    WHERE indicateur_code = ANY(p_codes)
  LOOP
    INSERT INTO public.valeurs_indicateurs
      (indicateur_code, valeur_numerique, valeur_detail, calculee_at, publiee_at, publiee_par)
    VALUES
      (v_rec.indicateur_code, v_rec.valeur_numerique, v_rec.valeur_detail, v_now, v_now, v_uid)
    ON CONFLICT (indicateur_code, periode) DO UPDATE
      SET valeur_numerique = EXCLUDED.valeur_numerique,
          valeur_detail    = EXCLUDED.valeur_detail,
          calculee_at      = EXCLUDED.calculee_at,
          publiee_at       = EXCLUDED.publiee_at,
          publiee_par      = EXCLUDED.publiee_par;
    v_cnt := v_cnt + 1;
  END LOOP;

  RETURN v_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publier_indicateurs_v1(TEXT[]) TO authenticated;
