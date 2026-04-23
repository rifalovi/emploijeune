-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 004 : statut de validation
-- -----------------------------------------------------------------------------
-- Ajoute la colonne statut_validation sur utilisateurs + patch des helpers RLS
-- pour exiger statut='valide' + table notifications_admin + trigger de création
-- automatique de notification lors de tout nouveau compte en attente.
--
-- Décision Q1 de l'Étape 3 : bootstrap Option A (auto-création en 'en_attente')
-- avec renforcements : un compte non validé ne voit strictement rien.
-- =============================================================================

-- 1. Colonne statut_validation sur utilisateurs --------------------------------
ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS statut_validation TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut_validation IN ('en_attente', 'valide', 'rejete'));

CREATE INDEX IF NOT EXISTS idx_utilisateurs_statut_validation
  ON public.utilisateurs(statut_validation)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.utilisateurs.statut_validation IS
  'Trois états : en_attente (créé auto au premier login, pas encore validé par SCS), valide (accès effectif), rejete (accès définitivement refusé)';

-- 2. Patch des helpers RLS : tout filtre sur statut_validation = 'valide' ------
-- current_role_metier : retourne NULL si pas valide (donc aucun accès)
CREATE OR REPLACE FUNCTION public.current_role_metier()
RETURNS public.role_utilisateur
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
BEGIN
  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = auth.uid()
    AND actif = TRUE
    AND deleted_at IS NULL
    AND statut_validation = 'valide'
  LIMIT 1;

  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_organisation_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organisation_id INTO v_org
  FROM public.utilisateurs
  WHERE user_id = auth.uid()
    AND actif = TRUE
    AND deleted_at IS NULL
    AND statut_validation = 'valide'
  LIMIT 1;

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_projets_geres()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projets TEXT[];
BEGIN
  SELECT o.projets_geres INTO v_projets
  FROM public.utilisateurs u
  JOIN public.organisations o ON o.id = u.organisation_id
  WHERE u.user_id = auth.uid()
    AND u.actif = TRUE
    AND u.deleted_at IS NULL
    AND u.statut_validation = 'valide'
    AND o.actif = TRUE
    AND o.deleted_at IS NULL
  LIMIT 1;

  RETURN COALESCE(v_projets, ARRAY[]::TEXT[]);
END;
$$;

-- is_admin_scs hérite automatiquement : il appelle current_role_metier()

-- 3. Helper public : vérifier le propre statut de l'utilisateur courant --------
-- Utilisé côté app pour router vers /en-attente-de-validation.
-- Ne filtre PAS sur statut_validation (c'est la fonction qui LE renvoie).
CREATE OR REPLACE FUNCTION public.current_statut_validation()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statut TEXT;
BEGIN
  SELECT statut_validation INTO v_statut
  FROM public.utilisateurs
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN v_statut;  -- NULL si pas de ligne (bootstrap pas encore fait)
END;
$$;

COMMENT ON FUNCTION public.current_statut_validation IS
  'Retourne le statut_validation de l''utilisateur courant ou NULL s''il n''est pas encore enregistré en table utilisateurs';

-- 4. Table notifications_admin -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id_concerne UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donnees JSONB NOT NULL DEFAULT '{}'::jsonb,
  lue BOOLEAN NOT NULL DEFAULT FALSE,
  lue_par UUID REFERENCES auth.users(id),
  lue_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_admin_non_lues
  ON public.notifications_admin(created_at DESC)
  WHERE lue = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_admin_type
  ON public.notifications_admin(type);

COMMENT ON TABLE public.notifications_admin IS
  'File d''attente de notifications pour l''admin SCS : comptes à valider, alertes qualité, etc.';

-- Active RLS : seuls les admin_scs voient ces notifications
ALTER TABLE public.notifications_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_admin_select ON public.notifications_admin
  FOR SELECT TO authenticated
  USING (public.is_admin_scs());

CREATE POLICY notifications_admin_update ON public.notifications_admin
  FOR UPDATE TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- L'INSERT passe uniquement par les triggers SECURITY DEFINER (pas de policy INSERT)

-- 5. Trigger : notification automatique à la création d'un compte -------------
CREATE OR REPLACE FUNCTION public.tg_notifier_admin_nouveau_compte()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NEW.statut_validation <> 'en_attente' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  INSERT INTO public.notifications_admin(type, message, user_id_concerne, donnees)
  VALUES (
    'nouveau_compte_a_valider',
    format('Nouveau compte créé : %s — à valider par le SCS', COALESCE(v_email, NEW.nom_complet)),
    NEW.user_id,
    jsonb_build_object(
      'nom_complet', NEW.nom_complet,
      'email', v_email,
      'cree_le', NEW.created_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifier_admin_nouveau_compte ON public.utilisateurs;
CREATE TRIGGER trg_notifier_admin_nouveau_compte
  AFTER INSERT ON public.utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notifier_admin_nouveau_compte();

-- 6. Trigger : notification à la transition en_attente -> valide ou rejete ----
-- (optionnel, utile pour traçabilité ; ne vise pas l'admin mais un journal)
CREATE OR REPLACE FUNCTION public.tg_notifier_admin_changement_statut()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut_validation IS DISTINCT FROM NEW.statut_validation
     AND NEW.statut_validation IN ('valide', 'rejete') THEN
    -- Marquer toute notification 'nouveau_compte_a_valider' non lue concernant cet utilisateur
    UPDATE public.notifications_admin
    SET lue = TRUE,
        lue_le = NOW()
    WHERE type = 'nouveau_compte_a_valider'
      AND user_id_concerne = NEW.user_id
      AND lue = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifier_admin_changement_statut ON public.utilisateurs;
CREATE TRIGGER trg_notifier_admin_changement_statut
  AFTER UPDATE ON public.utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notifier_admin_changement_statut();

-- 7. Utilitaire admin : compteur de notifications non lues --------------------
CREATE OR REPLACE FUNCTION public.notifications_admin_non_lues_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin_scs() THEN (
      SELECT COUNT(*)::INTEGER FROM public.notifications_admin WHERE lue = FALSE
    )
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.current_statut_validation TO authenticated;
GRANT EXECUTE ON FUNCTION public.notifications_admin_non_lues_count TO authenticated;
