-- =============================================================================
-- permissions_delegues — délégation de modules super-admin à des admin_scs
-- =============================================================================

CREATE TABLE public.permissions_delegues (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id  UUID        NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  module_key      TEXT        NOT NULL,
  actif           BOOLEAN     NOT NULL DEFAULT true,
  granted_by      UUID        REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_permission_module UNIQUE (utilisateur_id, module_key),
  CONSTRAINT chk_module_key CHECK (module_key IN (
    'contenu_pages',
    'affichage_public',
    'analyses_indicateurs',
    'base_connaissance',
    'tracking',
    'import_sessions',
    'doublons',
    'nettoyage_donnees',
    'referentiels'
  ))
);

CREATE INDEX idx_permissions_delegues_user ON public.permissions_delegues (utilisateur_id, actif);

CREATE OR REPLACE FUNCTION public.set_permissions_delegues_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_permissions_delegues_updated_at
  BEFORE UPDATE ON public.permissions_delegues
  FOR EACH ROW EXECUTE FUNCTION public.set_permissions_delegues_updated_at();

ALTER TABLE public.permissions_delegues ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.permissions_delegues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions_delegues TO authenticated;

-- super_admin : accès total
CREATE POLICY pd_super_admin ON public.permissions_delegues
  USING (EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = auth.uid() AND role = 'super_admin' AND deleted_at IS NULL
  ));

-- admin_scs : lecture de ses propres permissions uniquement
CREATE POLICY pd_admin_scs_read ON public.permissions_delegues FOR SELECT
  USING (utilisateur_id = auth.uid());
