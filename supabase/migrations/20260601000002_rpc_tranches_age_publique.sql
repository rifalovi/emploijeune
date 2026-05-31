-- =============================================================================
-- Migration 20260601000002 — RPC publique tranches d'age actives
-- -----------------------------------------------------------------------------
-- Pourquoi : le formulaire de collecte publique (anon) et le smart-mapper
--   (authenticated) doivent pouvoir lire les tranches actives sans acceder
--   directement a la table. SECURITY DEFINER contourne le RLS pour anon.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_tranches_age_actives_v1()
RETURNS TABLE (
  id UUID,
  libelle TEXT,
  borne_min INT,
  borne_max INT,
  categorie_oif TEXT,
  ordre INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, libelle, borne_min, borne_max, categorie_oif, ordre
  FROM public.tranches_age_precises
  WHERE actif = TRUE
  ORDER BY ordre;
$$;

REVOKE ALL ON FUNCTION public.get_tranches_age_actives_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tranches_age_actives_v1() TO anon, authenticated;

COMMENT ON FUNCTION public.get_tranches_age_actives_v1 IS
  'Tranches d''age precises actives, ordonnees. Accessible aux formulaires
   de collecte publique (anon). Donnees non sensibles, lecture seule.';
