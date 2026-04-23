-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 008 :
-- Métadonnées de suppression + support exclusion dans find_beneficiaire_doublon
-- -----------------------------------------------------------------------------
-- Ajoute les colonnes `deleted_by` et `deleted_reason` sur `beneficiaires`
-- pour tracer QUI a supprimé QUOI et POURQUOI, en complément du journal
-- d'audit qui enregistre l'action mais pas la raison métier.
--
-- Étend aussi la fonction `find_beneficiaire_doublon` avec un paramètre
-- optionnel d'exclusion pour le mode édition (une fiche ne doit pas se
-- détecter elle-même comme doublon lors d'une mise à jour).
-- =============================================================================

-- 1. Métadonnées soft-delete sur beneficiaires --------------------------------
ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

COMMENT ON COLUMN public.beneficiaires.deleted_by IS
  'Utilisateur ayant déclenché la suppression logique (admin_scs uniquement, vérifié côté Server Action).';
COMMENT ON COLUMN public.beneficiaires.deleted_reason IS
  'Raison optionnelle saisie par l''admin au moment de la suppression. Conservée pour justifier l''action auprès du partenaire ou du SCS.';

-- 2. Fonction find_beneficiaire_doublon avec exclusion optionnelle ------------
-- Remplace la version précédente. L'ordre des paramètres est conservé et un
-- paramètre optionnel p_exclude_id est ajouté en fin → rétro-compatible avec
-- les appels existants depuis mutations.ts (création).
CREATE OR REPLACE FUNCTION public.find_beneficiaire_doublon(
  p_prenom TEXT,
  p_nom TEXT,
  p_date_naissance DATE,
  p_projet_code TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  prenom TEXT,
  nom TEXT,
  date_naissance DATE,
  projet_code TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id, prenom, nom, date_naissance, projet_code
  FROM public.beneficiaires
  WHERE p_date_naissance IS NOT NULL
    AND lower(public.unaccent_immutable(prenom)) = lower(public.unaccent_immutable(p_prenom))
    AND lower(public.unaccent_immutable(nom)) = lower(public.unaccent_immutable(p_nom))
    AND date_naissance = p_date_naissance
    AND projet_code = p_projet_code
    AND deleted_at IS NULL
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_beneficiaire_doublon(TEXT, TEXT, DATE, TEXT, UUID) IS
  'Détection de doublon. p_exclude_id permet de passer l''id de la fiche en cours d''édition pour éviter qu''elle se détecte elle-même comme doublon. SECURITY INVOKER — respecte RLS.';

GRANT EXECUTE ON FUNCTION public.find_beneficiaire_doublon(TEXT, TEXT, DATE, TEXT, UUID) TO authenticated;
