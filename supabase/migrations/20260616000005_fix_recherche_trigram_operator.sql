-- =============================================================================
-- Migration 20260616000005 — Correctif recherche : opérateur trigramme `%`
-- -----------------------------------------------------------------------------
-- Les fonctions rechercher_beneficiaires / rechercher_structures utilisaient
-- l'opérateur `%%` (inexistant) au lieu de l'opérateur de similarité pg_trgm
-- `%` (« text % text » → booléen si similarité ≥ pg_trgm.similarity_threshold).
-- Résultat : toute recherche échouait avec
--   « operator does not exist: text %% text ».
-- On recrée les deux fonctions à l'identique en remplaçant `%%` par `%`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rechercher_beneficiaires(
  search_text TEXT,
  seuil_similarite REAL DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  similarite REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  IF search_text IS NULL OR length(trim(search_text)) < 2 THEN
    RETURN;
  END IF;

  v_normalized := lower(public.unaccent_immutable(trim(search_text)));

  PERFORM set_config('pg_trgm.similarity_threshold', seuil_similarite::text, true);

  RETURN QUERY
  SELECT
    b.id,
    similarity(
      lower(public.unaccent_immutable(b.nom) || ' ' || public.unaccent_immutable(b.prenom)),
      v_normalized
    ) AS sim
  FROM public.beneficiaires b
  WHERE b.deleted_at IS NULL
    AND lower(public.unaccent_immutable(b.nom) || ' ' || public.unaccent_immutable(b.prenom))
        % v_normalized
  ORDER BY sim DESC, b.nom ASC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechercher_beneficiaires(TEXT, REAL) TO authenticated;

CREATE OR REPLACE FUNCTION public.rechercher_structures(
  search_text TEXT,
  seuil_similarite REAL DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  similarite REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  IF search_text IS NULL OR length(trim(search_text)) < 2 THEN
    RETURN;
  END IF;

  v_normalized := lower(public.unaccent_immutable(trim(search_text)));

  PERFORM set_config('pg_trgm.similarity_threshold', seuil_similarite::text, true);

  RETURN QUERY
  SELECT
    s.id,
    similarity(
      lower(public.unaccent_immutable(s.nom_structure)),
      v_normalized
    ) AS sim
  FROM public.structures s
  WHERE s.deleted_at IS NULL
    AND lower(public.unaccent_immutable(s.nom_structure)) % v_normalized
  ORDER BY sim DESC, s.nom_structure ASC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechercher_structures(TEXT, REAL) TO authenticated;
