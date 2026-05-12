-- =============================================================================
-- Migration — Module IA d'import (toggle activable par super_admin)
-- -----------------------------------------------------------------------------
-- Ajoute une 2e fonctionnalité IA toggleable : `import_ia` (extraction PDF/DOCX
-- + suggestions de mapping). Réutilise la table `activation_modules` et la
-- RPC `toggle_module_pour_role` existantes — pas besoin de schéma additionnel,
-- juste un nouveau nom de module conventionnel.
--
-- Ce qu'apporte cette migration :
--   1. Une RPC paramétrable `module_actif_pour_courant(p_module TEXT)` qui
--      remplace progressivement l'ancienne `module_ia_actif_pour_courant()`
--      hardcodée sur 'assistant_ia'. L'ancienne reste pour compatibilité.
--   2. Un seed pour activer `import_ia` côté super_admin (toujours TRUE) et
--      le créer désactivé par défaut pour admin_scs (le super_admin l'active
--      explicitement depuis /super-admin/modules).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RPC paramétrable : test d'activation pour un module arbitraire
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.module_actif_pour_courant(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT active FROM public.activation_modules
    WHERE module = p_module
      AND role_cible = public.current_role_metier()
    LIMIT 1
  ), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.module_actif_pour_courant(TEXT) TO authenticated;

COMMENT ON FUNCTION public.module_actif_pour_courant IS
  'TRUE si le module nommé est activé pour le rôle de l''utilisateur authentifié. Version paramétrable de module_ia_actif_pour_courant() (qui reste pour compat).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed initial de l'activation_modules pour import_ia
-- ─────────────────────────────────────────────────────────────────────────────
-- Super_admin : toujours actif (il a accès à tout).
-- Autres rôles : désactivé par défaut, super_admin doit activer manuellement.

INSERT INTO public.activation_modules (module, role_cible, active, updated_at)
VALUES
  ('import_ia', 'super_admin', TRUE, NOW()),
  ('import_ia', 'admin_scs', FALSE, NOW()),
  ('import_ia', 'editeur_projet', FALSE, NOW()),
  ('import_ia', 'contributeur_partenaire', FALSE, NOW()),
  ('import_ia', 'lecteur', FALSE, NOW())
ON CONFLICT (module, role_cible) DO NOTHING;
