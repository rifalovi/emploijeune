-- =============================================================================
-- Liens de collecte publique — enregistrement sans compte ni token email
-- -----------------------------------------------------------------------------
-- Permet aux administrateurs de générer des liens réutilisables (Type A pour
-- bénéficiaires, Type B pour structures) que n'importe qui peut utiliser pour
-- s'enregistrer, SANS avoir un compte ni avoir reçu un email nominatif.
--
-- Différence clé avec tokens_enquete_publique :
--   - Les tokens sont mono-usage et liés à une entité existante en base.
--   - Les liens collecte sont réutilisables et créent de NOUVELLES entités
--     après validation admin.
--
-- Workflow :
--   1. Admin génère un lien → slug court unique + type A ou B + projet optionnel.
--   2. Partage du lien (WhatsApp, affiche, QR code, etc.).
--   3. N'importe qui soumet le formulaire → INSERT dans soumissions_collecte.
--   4. Admin voit les soumissions en attente dans le tableau de bord.
--   5. Admin valide → INSERT dans beneficiaires ou structures + maj statut.
--      Admin rejette → statut = rejete, motif optionnel.
--
-- Sécurité :
--   - Slug aléatoire 12 chars alphanumériques (pas prévisible).
--   - Données soumission stockées JSONB — validées à nouveau côté serveur avant insertion.
--   - Consentement toujours false à la création — admin doit confirmer avec le porteur.
--   - IP address capturée (optionnel) pour audit/rate-limit.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table 1 : liens_collecte_publique
-- ---------------------------------------------------------------------------
CREATE TABLE public.liens_collecte_publique (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Slug public (URL : /collecte/public/<slug>)
  slug        TEXT NOT NULL UNIQUE
                CHECK (slug ~ '^[a-zA-Z0-9_-]{6,32}$'),

  -- Type A = bénéficiaire (formulaire A1), Type B = structure (formulaire B1)
  type        TEXT NOT NULL CHECK (type IN ('A', 'B')),

  -- Label lisible pour le back-office
  label       TEXT NOT NULL DEFAULT '',

  -- Projet optionnel (pré-rempli dans les soumissions)
  projet_code TEXT REFERENCES public.projets(code) ON DELETE SET NULL,

  -- Statut du lien
  statut      TEXT NOT NULL DEFAULT 'actif'
                CHECK (statut IN ('actif', 'inactif', 'expire')),

  -- Expiration optionnelle (null = pas d'expiration)
  expire_at   TIMESTAMPTZ,

  -- Audit
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_liens_collecte_slug
  ON public.liens_collecte_publique(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_liens_collecte_statut
  ON public.liens_collecte_publique(statut)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_liens_collecte_projet
  ON public.liens_collecte_publique(projet_code)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.liens_collecte_publique IS
  'Liens réutilisables de collecte publique (Type A = bénéficiaire, Type B = structure). '
  'Différent des tokens_enquete_publique (mono-usage, entité existante). '
  'Chaque soumission passe en attente de validation admin avant intégration en base.';

-- Trigger updated_at
CREATE TRIGGER set_updated_at_liens_collecte
  BEFORE UPDATE ON public.liens_collecte_publique
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
ALTER TABLE public.liens_collecte_publique ENABLE ROW LEVEL SECURITY;

-- Lecture : admins voient tout, éditeurs voient les leurs
CREATE POLICY liens_collecte_admin_select
  ON public.liens_collecte_publique FOR SELECT TO authenticated
  USING (public.is_admin_scs() AND deleted_at IS NULL);

CREATE POLICY liens_collecte_editor_select
  ON public.liens_collecte_publique FOR SELECT TO authenticated
  USING (
    public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
    AND created_by = auth.uid()
    AND deleted_at IS NULL
  );

-- Insertion : admins + éditeurs
CREATE POLICY liens_collecte_insert
  ON public.liens_collecte_publique FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
  );

-- Mise à jour (statut, label) : admins seulement
CREATE POLICY liens_collecte_update
  ON public.liens_collecte_publique FOR UPDATE TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- ---------------------------------------------------------------------------
-- Table 2 : soumissions_collecte
-- ---------------------------------------------------------------------------
CREATE TABLE public.soumissions_collecte (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien d'origine
  lien_id         UUID NOT NULL REFERENCES public.liens_collecte_publique(id) ON DELETE CASCADE,

  -- Type redondant pour faciliter les filtres (A ou B)
  type            TEXT NOT NULL CHECK (type IN ('A', 'B')),

  -- Données brutes soumises par l'utilisateur public (JSONB)
  donnees         JSONB NOT NULL DEFAULT '{}',

  -- Statut du workflow de validation
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'valide', 'rejete')),

  -- Motif de rejet (optionnel, renseigné par l'admin)
  motif_rejet     TEXT,

  -- Admin qui a validé ou rejeté
  valide_par      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_at       TIMESTAMPTZ,

  -- ID de l'entité créée après validation (beneficiaire.id ou structure.id)
  entite_creee_id UUID,

  -- Adresse IP pour audit et anti-spam (optionnel)
  ip_address      INET,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cohérence type avec lien parent (vérifiée via trigger, pas CHECK)
  CONSTRAINT chk_soumission_rejet_motif CHECK (
    statut <> 'rejete' OR motif_rejet IS NOT NULL
  )
);

CREATE INDEX idx_soumissions_lien
  ON public.soumissions_collecte(lien_id);

CREATE INDEX idx_soumissions_statut
  ON public.soumissions_collecte(statut)
  WHERE statut = 'en_attente';

CREATE INDEX idx_soumissions_created
  ON public.soumissions_collecte(created_at DESC);

COMMENT ON TABLE public.soumissions_collecte IS
  'Soumissions en attente de validation admin issues des liens_collecte_publique. '
  'Chaque ligne passe par le workflow en_attente → valide (créé en DB) ou rejete.';

-- Trigger updated_at
CREATE TRIGGER set_updated_at_soumissions_collecte
  BEFORE UPDATE ON public.soumissions_collecte
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
ALTER TABLE public.soumissions_collecte ENABLE ROW LEVEL SECURITY;

-- Lecture : admins voient tout
CREATE POLICY soumissions_admin_select
  ON public.soumissions_collecte FOR SELECT TO authenticated
  USING (public.is_admin_scs());

-- Éditeurs voient les soumissions de leurs liens
CREATE POLICY soumissions_editor_select
  ON public.soumissions_collecte FOR SELECT TO authenticated
  USING (
    public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
    AND EXISTS (
      SELECT 1 FROM public.liens_collecte_publique l
      WHERE l.id = lien_id AND l.created_by = auth.uid()
    )
  );

-- INSERT : autorisé uniquement via service_role (route publique sans auth)
-- => pas de policy INSERT pour authenticated → les soumissions passent
--    uniquement par les Server Actions utilisant createSupabaseAdminClient().

-- UPDATE (validation/rejet) : admins seulement
CREATE POLICY soumissions_admin_update
  ON public.soumissions_collecte FOR UPDATE TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- ---------------------------------------------------------------------------
-- Vue de comptage utile pour le tableau de bord admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_liens_collecte_stats AS
SELECT
  l.id,
  l.slug,
  l.type,
  l.label,
  l.projet_code,
  l.statut,
  l.expire_at,
  l.created_at,
  l.created_by,
  COUNT(s.id)                                           AS nb_total,
  COUNT(s.id) FILTER (WHERE s.statut = 'en_attente')   AS nb_en_attente,
  COUNT(s.id) FILTER (WHERE s.statut = 'valide')       AS nb_valide,
  COUNT(s.id) FILTER (WHERE s.statut = 'rejete')       AS nb_rejete,
  MAX(s.created_at)                                    AS derniere_soumission_at
FROM public.liens_collecte_publique l
LEFT JOIN public.soumissions_collecte s ON s.lien_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.id;

COMMENT ON VIEW public.v_liens_collecte_stats IS
  'Vue agrégée liens_collecte_publique + compteurs soumissions par statut.';
