-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 010 :
-- Fonction de détection doublon B1 (analogue find_beneficiaire_doublon)
-- -----------------------------------------------------------------------------
-- Décision Q3 Étape 5 : clé de dédup `(nom_structure, pays_code, projet_code)`.
-- L'index UNIQUE existe déjà en migration 001 (idx_structures_dedoublonnage).
-- Cette fonction sert à pré-vérifier le doublon AVANT INSERT pour fournir un
-- message utilisateur exploitable (vs. erreur 23505 brute).
--
-- Tolérance : on utilise similarity() pg_trgm sur unaccent_immutable+lower()
-- du nom, en plus du match exact (pays, projet). Seuil ajustable, défaut
-- 0.85 (très strict — vise les variations orthographiques mineures, pas les
-- approximations).
--
-- SECURITY INVOKER → respect RLS (un contributeur ne détectera de doublon
-- que parmi les structures de son périmètre). Ajout d'un paramètre
-- `p_exclude_id` pour le mode édition (la fiche en cours ne doit pas se
-- détecter elle-même comme doublon).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_structure_doublon(
  p_nom_structure TEXT,
  p_pays_code TEXT,
  p_projet_code TEXT,
  p_seuil_similarite REAL DEFAULT 0.85,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nom_structure TEXT,
  pays_code TEXT,
  projet_code TEXT,
  similarity_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_nom_structure IS NULL OR length(trim(p_nom_structure)) = 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('pg_trgm.similarity_threshold', p_seuil_similarite::text, true);

  RETURN QUERY
  SELECT
    s.id,
    s.nom_structure,
    s.pays_code,
    s.projet_code,
    similarity(
      lower(public.unaccent_immutable(s.nom_structure)),
      lower(public.unaccent_immutable(p_nom_structure))
    ) AS similarity_score
  FROM public.structures s
  WHERE s.deleted_at IS NULL
    AND s.pays_code = p_pays_code
    AND s.projet_code = p_projet_code
    AND (p_exclude_id IS NULL OR s.id <> p_exclude_id)
    AND similarity(
      lower(public.unaccent_immutable(s.nom_structure)),
      lower(public.unaccent_immutable(p_nom_structure))
    ) >= p_seuil_similarite
  ORDER BY similarity_score DESC, s.nom_structure ASC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION public.find_structure_doublon IS
  'Détection de doublon B1 sur (nom_structure, pays_code, projet_code) avec tolérance similarity (défaut 0.85). p_exclude_id pour le mode édition. SECURITY INVOKER — respecte RLS.';

GRANT EXECUTE ON FUNCTION public.find_structure_doublon(TEXT, TEXT, TEXT, REAL, UUID) TO authenticated;
