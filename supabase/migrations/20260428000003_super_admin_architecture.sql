-- =============================================================================
-- v2.0.0 — Architecture super_admin : tables, helpers, RLS, promotion Carlos
-- -----------------------------------------------------------------------------
-- Hierarchie de roles :
--   super_admin (Carlos seul) > admin_scs (équipe SCS) > chef_projet >
--   contributeur_partenaire > lecteur
--
-- Le super_admin hérite automatiquement de tous les privilèges admin_scs
-- (is_admin_scs() retourne TRUE pour les deux), ET dispose de fonctions
-- exclusives :
--   - Activation/désactivation des modules optionnels (IA) par rôle cible
--   - Suspension temporaire / bannissement d'utilisateurs
--   - Archivage de partenaires (organisations)
--   - Tracking étendu (lecture totale du journal d'audit)
--
-- Cette migration :
--   1. Crée 3 nouvelles tables (activation_modules, suspensions_utilisateurs,
--      archives_partenaires)
--   2. Met à jour is_admin_scs() pour inclure super_admin (héritage)
--   3. Crée la fonction is_super_admin() pour les checks exclusifs
--   4. RLS policies sur les nouvelles tables
--   5. Promeut Carlos en super_admin (UUID confirmé par l'utilisateur)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Helpers de rôle
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_metier() = 'super_admin', FALSE);
$$;

COMMENT ON FUNCTION public.is_super_admin IS
  'Rôle exclusif super_admin (Carlos). Au-dessus de admin_scs dans la hiérarchie.';

-- is_admin_scs : super_admin hérite des privilèges admin_scs.
-- Cela évite de modifier toutes les policies existantes qui testent
-- is_admin_scs() — elles s'appliquent automatiquement aux super_admin.
CREATE OR REPLACE FUNCTION public.is_admin_scs()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_metier() IN ('admin_scs', 'super_admin'), FALSE);
$$;

COMMENT ON FUNCTION public.is_admin_scs IS
  'Privilèges admin_scs (V1) ou super_admin (v2.0.0+, héritage automatique).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Table activation_modules — contrôle visibilité du module IA par rôle
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activation_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  role_cible public.role_utilisateur NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  activated_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module, role_cible)
);

CREATE INDEX IF NOT EXISTS idx_activation_modules_module_role
  ON public.activation_modules(module, role_cible);

COMMENT ON TABLE public.activation_modules IS
  'Activation des modules optionnels (ex. assistant IA) par rôle cible. Géré exclusivement par super_admin.';

-- Bootstrap : créer une ligne désactivée pour chaque (module, rôle)
-- afin que la lecture par défaut renvoie active=FALSE plutôt que NULL.
INSERT INTO public.activation_modules (module, role_cible, active)
VALUES
  ('assistant_ia', 'super_admin', TRUE),  -- Carlos a toujours l'IA
  ('assistant_ia', 'admin_scs', FALSE),
  ('assistant_ia', 'editeur_projet', FALSE),
  ('assistant_ia', 'contributeur_partenaire', FALSE),
  ('assistant_ia', 'lecteur', FALSE)
ON CONFLICT (module, role_cible) DO NOTHING;

-- RLS : super_admin SEUL peut écrire ; tous peuvent lire la ligne qui les
-- concerne (pour que le frontend puisse savoir si le module est activé).
ALTER TABLE public.activation_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activation_modules_lecture ON public.activation_modules;
CREATE POLICY activation_modules_lecture ON public.activation_modules
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR role_cible = public.current_role_metier()
  );

DROP POLICY IF EXISTS activation_modules_ecriture ON public.activation_modules;
CREATE POLICY activation_modules_ecriture ON public.activation_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Table suspensions_utilisateurs — suspensions temporaires / bannissements
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suspensions_utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suspendu_par UUID NOT NULL REFERENCES auth.users(id),
  date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_fin TIMESTAMPTZ,                          -- NULL = bannissement définitif
  motif TEXT,
  leve_at TIMESTAMPTZ,
  leve_par UUID REFERENCES auth.users(id),
  CONSTRAINT chk_suspension_dates CHECK (date_fin IS NULL OR date_fin > date_debut),
  CONSTRAINT chk_levee_coherente CHECK (
    (leve_at IS NULL AND leve_par IS NULL)
    OR (leve_at IS NOT NULL AND leve_par IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_suspensions_user ON public.suspensions_utilisateurs(user_id);
CREATE INDEX IF NOT EXISTS idx_suspensions_actives
  ON public.suspensions_utilisateurs(user_id)
  WHERE leve_at IS NULL;

COMMENT ON TABLE public.suspensions_utilisateurs IS
  'Suspensions temporaires (date_fin présente) ou bannissements (date_fin NULL). Géré par super_admin.';

-- Helper : retourne TRUE si l'utilisateur est actuellement suspendu/banni.
CREATE OR REPLACE FUNCTION public.is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.suspensions_utilisateurs
    WHERE user_id = p_user_id
      AND leve_at IS NULL
      AND date_debut <= NOW()
      AND (date_fin IS NULL OR date_fin > NOW())
  );
$$;

ALTER TABLE public.suspensions_utilisateurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suspensions_lecture ON public.suspensions_utilisateurs;
CREATE POLICY suspensions_lecture ON public.suspensions_utilisateurs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS suspensions_ecriture ON public.suspensions_utilisateurs;
CREATE POLICY suspensions_ecriture ON public.suspensions_utilisateurs
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Table archives_partenaires — archivage d'organisations partenaires
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.archives_partenaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  archive_par UUID NOT NULL REFERENCES auth.users(id),
  archive_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motif TEXT,
  desarchive_at TIMESTAMPTZ,
  desarchive_par UUID REFERENCES auth.users(id),
  CONSTRAINT chk_archive_levee_coherente CHECK (
    (desarchive_at IS NULL AND desarchive_par IS NULL)
    OR (desarchive_at IS NOT NULL AND desarchive_par IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_archives_organisation ON public.archives_partenaires(organisation_id);
CREATE INDEX IF NOT EXISTS idx_archives_actives
  ON public.archives_partenaires(organisation_id)
  WHERE desarchive_at IS NULL;

COMMENT ON TABLE public.archives_partenaires IS
  'Archivage de partenaires (organisations). En archive : utilisateurs liés désactivés. Géré par super_admin.';

-- Helper : retourne TRUE si l'organisation est actuellement archivée.
CREATE OR REPLACE FUNCTION public.is_organisation_archived(p_organisation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.archives_partenaires
    WHERE organisation_id = p_organisation_id
      AND desarchive_at IS NULL
  );
$$;

ALTER TABLE public.archives_partenaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS archives_lecture ON public.archives_partenaires;
CREATE POLICY archives_lecture ON public.archives_partenaires
  FOR SELECT TO authenticated
  USING (public.is_admin_scs());

DROP POLICY IF EXISTS archives_ecriture ON public.archives_partenaires;
CREATE POLICY archives_ecriture ON public.archives_partenaires
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC : activer/désactiver un module pour un rôle (super_admin only)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_module_pour_role(
  p_module TEXT,
  p_role_cible public.role_utilisateur,
  p_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;

  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  INSERT INTO public.activation_modules (module, role_cible, active, activated_by, updated_at)
  VALUES (p_module, p_role_cible, p_active, v_uid, NOW())
  ON CONFLICT (module, role_cible)
  DO UPDATE SET active = EXCLUDED.active, activated_by = v_uid, updated_at = NOW();

  RETURN jsonb_build_object('succes', TRUE, 'module', p_module, 'role_cible', p_role_cible, 'active', p_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_module_pour_role(TEXT, public.role_utilisateur, BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RPC : module IA actif pour le rôle de l'utilisateur courant
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.module_ia_actif_pour_courant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT active FROM public.activation_modules
    WHERE module = 'assistant_ia'
      AND role_cible = public.current_role_metier()
    LIMIT 1
  ), FALSE);
$$;

COMMENT ON FUNCTION public.module_ia_actif_pour_courant IS
  'TRUE si le module assistant_ia est activé pour le rôle de l''utilisateur authentifié.';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. PROMOTION CARLOS EN SUPER_ADMIN
-- -----------------------------------------------------------------------------
-- UUID confirmé par l'utilisateur dans le brief Sprint Final v2.0.0 :
--   d615b97c-ab2b-45eb-a2a9-3f377de906c8
--
-- Idempotent : si Carlos est déjà super_admin, l'UPDATE ne change rien.
-- Si l'UUID n'existe pas (cas dev / autre seed), le UPDATE n'a aucun effet
-- — pas d'erreur, mais on log un NOTICE pour debug.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.utilisateurs
  SET role = 'super_admin', updated_at = NOW()
  WHERE user_id = 'd615b97c-ab2b-45eb-a2a9-3f377de906c8'
    AND role <> 'super_admin';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE NOTICE 'Promotion super_admin : Carlos (UUID d615b97c...) introuvable ou déjà super_admin. Aucune action.';
  ELSE
    RAISE NOTICE 'Promotion super_admin : Carlos promu (% ligne mise à jour).', v_count;
  END IF;
END;
$$;
