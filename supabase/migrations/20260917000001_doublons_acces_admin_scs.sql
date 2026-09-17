-- ============================================================================
-- Détection & fusion des doublons — ouverture de l'accès aux admin SCS
-- ============================================================================
-- Contexte : les fonctions detecter_doublons_v1 / fusionner_doublons_v1 /
-- fusionner_doublons_bulk_v1 étaient verrouillées par `is_super_admin()`.
-- Conséquence : un admin_scs disposant du module « doublons » passait bien les
-- gardes applicatives (page + action serveur) mais la RPC levait une exception
-- (ERRCODE 42501) → l'action serveur avalait l'erreur et renvoyait [] → l'onglet
-- « Bénéficiaires (A1) » affichait 0 groupe, alors que les structures (B1),
-- calculées côté TypeScript via le client service-role, s'affichaient bien.
--
-- Correctif : on remplace le verrou `is_super_admin()` par `is_admin_scs()`
-- (vrai pour admin_scs ET super_admin). L'accès reste doublement contrôlé en
-- amont par la garde applicative `exigerAccesDoublons()` qui exige, pour un
-- admin_scs, la permission déléguée « doublons ». La RLS de `beneficiaires`
-- accorde déjà la lecture complète à `is_admin_scs()`, et ces fonctions sont
-- SECURITY DEFINER : le périmètre de données est donc bien l'ensemble des
-- bénéficiaires (comportement attendu : l'admin SCS voit tous les doublons).
--
-- Signatures inchangées → CREATE OR REPLACE sans DROP.
-- ============================================================================

-- ── detecter_doublons_v1 ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detecter_doublons_v1()
RETURNS TABLE (
  cle_identite TEXT,
  occurrences BIGINT,
  beneficiaire_ids UUID[],
  dates_creation TIMESTAMPTZ[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs SCS.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.cle_identite,
    COUNT(*) AS occurrences,
    ARRAY_AGG(b.id ORDER BY b.created_at) AS beneficiaire_ids,
    ARRAY_AGG(b.created_at ORDER BY b.created_at) AS dates_creation
  FROM public.beneficiaires b
  WHERE b.deleted_at IS NULL
    AND b.cle_identite IS NOT NULL
    AND b.cle_identite <> ''
  GROUP BY b.cle_identite
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detecter_doublons_v1() TO authenticated;


-- ── fusionner_doublons_v1 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fusionner_doublons_v1(p_cle TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nb BIGINT;
  v_garde UUID;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs SCS.'
      USING ERRCODE = '42501';
  END IF;

  -- Garder le plus ancien
  SELECT id INTO v_garde
  FROM public.beneficiaires
  WHERE cle_identite = p_cle AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_garde IS NULL THEN
    RETURN jsonb_build_object('erreur', 'Aucun beneficiaire trouve pour cette cle.');
  END IF;

  -- Soft-delete les autres
  UPDATE public.beneficiaires
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE cle_identite = p_cle
    AND deleted_at IS NULL
    AND id <> v_garde;

  GET DIAGNOSTICS v_nb = ROW_COUNT;

  -- Audit
  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'beneficiaires',
    v_garde,
    'UPDATE',
    jsonb_build_object(
      'contexte', 'fusion_doublons',
      'cle_identite', p_cle,
      'doublons_supprimes', v_nb,
      'garde', v_garde
    ),
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object('succes', TRUE, 'fusionnes', v_nb, 'garde', v_garde);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fusionner_doublons_v1(TEXT) TO authenticated;


-- ── fusionner_doublons_bulk_v1 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fusionner_doublons_bulk_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT := 0;
  v_rec RECORD;
  v_garde UUID;
  v_nb BIGINT;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs SCS.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT cle_identite
    FROM public.beneficiaires
    WHERE deleted_at IS NULL AND cle_identite IS NOT NULL AND cle_identite <> ''
    GROUP BY cle_identite
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_garde
    FROM public.beneficiaires
    WHERE cle_identite = v_rec.cle_identite AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE public.beneficiaires
    SET deleted_at = NOW(), deleted_by = auth.uid()
    WHERE cle_identite = v_rec.cle_identite
      AND deleted_at IS NULL
      AND id <> v_garde;

    GET DIAGNOSTICS v_nb = ROW_COUNT;
    v_total := v_total + v_nb;
  END LOOP;

  -- Audit global
  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'beneficiaires',
    gen_random_uuid(),
    'UPDATE',
    jsonb_build_object(
      'contexte', 'fusion_doublons_bulk',
      'doublons_supprimes', v_total
    ),
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object('succes', TRUE, 'nb_fusionnes', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fusionner_doublons_bulk_v1() TO authenticated;
