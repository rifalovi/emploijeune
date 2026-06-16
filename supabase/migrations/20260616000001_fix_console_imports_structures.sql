-- =============================================================================
-- Migration 20260616000001 — Console imports : prise en compte des STRUCTURES
-- -----------------------------------------------------------------------------
-- Bug : la console super-admin des sessions d'import ne comptait et n'annulait
-- que les BÉNÉFICIAIRES. Pour un import de STRUCTURES (B1) :
--   • `lignes_reelles` (colonne « LIGNES BDD ») affichait 0 → le bouton
--     « Annuler » (conditionné à lignes_reelles > 0) n'apparaissait jamais
--     → impossible d'annuler un import de structures.
--   • `annuler_session_import_v1` supprimait bien les structures mais renvoyait
--     `lignes_supprimees` = nombre de bénéficiaires uniquement (capturé avant le
--     DELETE des structures).
--
-- Correctif : compter et reporter bénéficiaires + structures.
-- =============================================================================

-- ── A. lister_sessions_imports_v1 — lignes_reelles = bénéficiaires + structures
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
    (
      (SELECT COUNT(*) FROM public.beneficiaires b
       WHERE b.import_session_id = s.id AND b.deleted_at IS NULL)
      +
      (SELECT COUNT(*) FROM public.structures st
       WHERE st.import_session_id = s.id AND st.deleted_at IS NULL)
    ) AS lignes_reelles,
    (s.statut = 'en_cours'
     AND s.created_at < NOW() - INTERVAL '30 minutes'
     AND (
       EXISTS (
         SELECT 1 FROM public.beneficiaires b2
         WHERE b2.import_session_id = s.id AND b2.deleted_at IS NULL
       )
       OR EXISTS (
         SELECT 1 FROM public.structures st2
         WHERE st2.import_session_id = s.id AND st2.deleted_at IS NULL
       )
     )
    ) AS est_zombie
  FROM public.import_sessions s
  LEFT JOIN public.utilisateurs u ON u.user_id = s.created_by
  ORDER BY s.created_at DESC
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_sessions_imports_v1(INT) TO authenticated;


-- ── B. annuler_session_import_v1 — lignes_supprimees = bénéficiaires + structures
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
  v_nb_benef BIGINT;
  v_nb_struct BIGINT;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action reservee aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.import_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'Session introuvable.');
  END IF;

  IF v_session.statut LIKE '%annule%' THEN
    RETURN jsonb_build_object('erreur', 'Session deja annulee.');
  END IF;

  -- Soft-delete des bénéficiaires liés
  UPDATE public.beneficiaires
  SET deleted_at = NOW(),
      deleted_by = v_uid
  WHERE import_session_id = p_session_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_nb_benef = ROW_COUNT;

  -- Soft-delete des structures liées (import B1)
  UPDATE public.structures
  SET deleted_at = NOW()
  WHERE import_session_id = p_session_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_nb_struct = ROW_COUNT;

  UPDATE public.import_sessions
  SET statut = 'annule_admin',
      peut_rollback = FALSE
  WHERE id = p_session_id;

  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'import_sessions',
    p_session_id,
    'DELETE',
    jsonb_build_object(
      'contexte', 'annulation_session_import',
      'fichier_nom', v_session.fichier_nom,
      'lignes_supprimees', v_nb_benef + v_nb_struct,
      'beneficiaires_supprimes', v_nb_benef,
      'structures_supprimees', v_nb_struct,
      'motif', COALESCE(p_motif, 'Non specifie')
    ),
    v_uid,
    NOW()
  );

  RETURN jsonb_build_object(
    'succes', TRUE,
    'lignes_supprimees', v_nb_benef + v_nb_struct,
    'session_id', p_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.annuler_session_import_v1(UUID, TEXT) TO authenticated;
