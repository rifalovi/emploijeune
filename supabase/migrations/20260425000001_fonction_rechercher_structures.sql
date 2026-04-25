-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 009 :
-- Fonction de recherche textuelle pour les structures (indicateur B1)
-- -----------------------------------------------------------------------------
-- Décision Q1 Étape 5 : recherche sur `nom_structure` UNIQUEMENT (cohérent
-- avec l'usage terrain — l'utilisateur cherche le nom de l'entité, pas le
-- porteur). Étendre au porteur si retour pilote justifie.
--
-- Mêmes garanties qu'A1 :
--   - SECURITY INVOKER → respect RLS automatique (un contributeur ne voit
--     que les structures de son périmètre).
--   - Index GIN trigram `idx_structures_recherche` (migration 001) sur
--     `unaccent_immutable(nom_structure)`.
--   - Plafond 500 résultats pour éviter qu'une recherche très large ne
--     remonte des milliers de lignes.
--   - Seuil de similarité ajustable (défaut 0.3, comme A1).
-- =============================================================================

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

  -- Positionner le seuil de similarité pour l'opérateur %% le temps de la
  -- requête uniquement (SET LOCAL via set_config(..., true)).
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
    AND lower(public.unaccent_immutable(s.nom_structure)) %% v_normalized
  ORDER BY sim DESC, s.nom_structure ASC
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION public.rechercher_structures IS
  'Recherche tolérante aux typos sur nom_structure via pg_trgm. SECURITY INVOKER — respecte RLS. Seuil par défaut 0.3, plafond 500 résultats.';

GRANT EXECUTE ON FUNCTION public.rechercher_structures(TEXT, REAL) TO authenticated;
