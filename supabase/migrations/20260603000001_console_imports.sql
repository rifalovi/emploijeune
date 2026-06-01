-- =============================================================================
-- Migration 20260603000001 — Phase 11 : console super-admin imports + doublons
-- -----------------------------------------------------------------------------
-- 5 RPC pour gerer les sessions d'import et les doublons depuis l'UI.
-- Toutes protegees par is_super_admin() en defense-in-depth.
-- =============================================================================


-- ── A. lister_sessions_imports_v1 ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lister_sessions_imports_v1(
  p_limite INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  fichier_nom TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  created_by_nom TEXT,
  statut TEXT,
  nb_inserees INT,
  nb_doublons INT,
  nb_rejetees INT,
  peut_rollback BOOLEAN,
  rollback_expire_at TIMESTAMPTZ,
  lignes_reelles BIGINT,
  est_zombie BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.fichier_nom,
    s.created_at,
    s.created_by,
    COALESCE(u.nom_complet, 'Inconnu') AS created_by_nom,
    s.statut,
    s.nb_inserees,
    s.nb_doublons,
    s.nb_rejetees,
    s.peut_rollback,
    s.rollback_expire_at,
    (SELECT COUNT(*) FROM public.beneficiaires b
     WHERE b.import_session_id = s.id AND b.deleted_at IS NULL
    ) AS lignes_reelles,
    (s.statut = 'en_cours'
     AND s.created_at < NOW() - INTERVAL '30 minutes'
     AND EXISTS (
       SELECT 1 FROM public.beneficiaires b2
       WHERE b2.import_session_id = s.id AND b2.deleted_at IS NULL
     )
    ) AS est_zombie
  FROM public.import_sessions s
  LEFT JOIN public.utilisateurs u ON u.user_id = s.created_by
  ORDER BY s.created_at DESC
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_sessions_imports_v1(INT) TO authenticated;


-- ── B. annuler_session_import_v1 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.annuler_session_import_v1(
  p_session_id UUID,
  p_motif TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_nb_supprimees BIGINT;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  -- Charger la session
  SELECT * INTO v_session
  FROM public.import_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'Session introuvable.');
  END IF;

  IF v_session.statut LIKE '%annule%' THEN
    RETURN jsonb_build_object('erreur', 'Session deja annulee.');
  END IF;

  -- Soft-delete des beneficiaires lies
  UPDATE public.beneficiaires
  SET deleted_at = NOW(),
      deleted_by = v_uid
  WHERE import_session_id = p_session_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_nb_supprimees = ROW_COUNT;

  -- Soft-delete des structures liees (si import structures)
  UPDATE public.structures
  SET deleted_at = NOW()
  WHERE import_session_id = p_session_id
    AND deleted_at IS NULL;

  -- Marquer la session comme annulee
  UPDATE public.import_sessions
  SET statut = 'annule_admin',
      peut_rollback = FALSE
  WHERE id = p_session_id;

  -- Audit
  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'import_sessions',
    p_session_id,
    'DELETE',
    jsonb_build_object(
      'contexte', 'annulation_session_import',
      'fichier_nom', v_session.fichier_nom,
      'lignes_supprimees', v_nb_supprimees,
      'motif', COALESCE(p_motif, 'Non specifie')
    ),
    v_uid,
    NOW()
  );

  RETURN jsonb_build_object(
    'succes', TRUE,
    'lignes_supprimees', v_nb_supprimees,
    'session_id', p_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.annuler_session_import_v1(UUID, TEXT) TO authenticated;


-- ── C. detecter_doublons_v1 ──────────────────────────────────────────────────

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
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
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


-- ── D. fusionner_doublons_v1 ─────────────────────────────────────────────────

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
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
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


-- ── E. fusionner_doublons_bulk_v1 ────────────────────────────────────────────

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
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
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
