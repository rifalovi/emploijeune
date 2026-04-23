-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 006 : recherche textuelle
-- -----------------------------------------------------------------------------
-- Fonction de recherche tolérante aux typos sur les bénéficiaires.
--
-- Décision Q1 Étape 4b : Option B (pg_trgm similarity). Critique pour les
-- partenaires terrain (Mali, Haïti, Cambodge) dont les saisies peuvent
-- contenir des fautes de frappe, accents oubliés ou variations orthographiques.
--
-- SECURITY INVOKER : la fonction s'exécute avec les droits de l'utilisateur
-- appelant, donc la RLS des policies `beneficiaires_select` s'applique
-- automatiquement. Un contributeur ne verra dans les résultats que les
-- bénéficiaires de son périmètre, sans aucune fuite inter-organisation.
--
-- Utilise l'index GIN trigram `idx_beneficiaires_recherche` (migration 001)
-- sur `(unaccent_immutable(nom) || ' ' || unaccent_immutable(prenom))`.
-- =============================================================================

-- Permet au planificateur d'exploiter l'opérateur `%%` pour les comparaisons
-- trigramme. Défini à la session via `pg_trgm` déjà installé en migration 001.
-- Ajusté via SET LOCAL dans la fonction pour ne pas polluer la session globale.

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

  -- Positionner le seuil de similarité pour l'opérateur %%
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
        %% v_normalized
  ORDER BY sim DESC, b.nom ASC
  LIMIT 500;  -- Plafond dur pour éviter qu'une recherche très large ne renvoie des milliers de résultats
END;
$$;

COMMENT ON FUNCTION public.rechercher_beneficiaires IS
  'Recherche tolérante aux typos sur nom + prénom des bénéficiaires via pg_trgm. SECURITY INVOKER — respecte RLS. Seuil par défaut 0.3, plafond 500 résultats.';

GRANT EXECUTE ON FUNCTION public.rechercher_beneficiaires(TEXT, REAL) TO authenticated;
