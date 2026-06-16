-- =============================================================================
-- Migration 20260616000002 — Console imports : badge type (A1 / B1)
-- -----------------------------------------------------------------------------
-- Ajoute `type_import` à lister_sessions_imports_v1 pour distinguer dans la
-- console les imports de bénéficiaires (A1), de structures (B1), mixtes ou
-- inconnus. Le type est déduit des lignes liées (y compris soft-deleted, afin
-- qu'une session annulée affiche toujours son type).
-- =============================================================================

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
  est_zombie BOOLEAN,
  type_import TEXT
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
       EXISTS (SELECT 1 FROM public.beneficiaires b2
               WHERE b2.import_session_id = s.id AND b2.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.structures st2
                  WHERE st2.import_session_id = s.id AND st2.deleted_at IS NULL)
     )
    ) AS est_zombie,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.structures st3 WHERE st3.import_session_id = s.id)
       AND EXISTS (SELECT 1 FROM public.beneficiaires b3 WHERE b3.import_session_id = s.id)
        THEN 'mixte'
      WHEN EXISTS (SELECT 1 FROM public.structures st4 WHERE st4.import_session_id = s.id)
        THEN 'structures'
      WHEN EXISTS (SELECT 1 FROM public.beneficiaires b4 WHERE b4.import_session_id = s.id)
        THEN 'beneficiaires'
      ELSE 'inconnu'
    END AS type_import
  FROM public.import_sessions s
  LEFT JOIN public.utilisateurs u ON u.user_id = s.created_by
  ORDER BY s.created_at DESC
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_sessions_imports_v1(INT) TO authenticated;
