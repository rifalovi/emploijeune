-- =============================================================================
-- V1-Enrichie-A — Demandes d'accès auto-service
-- -----------------------------------------------------------------------------
-- Permet à un visiteur non authentifié de demander l'accès à la plateforme
-- via /demande-acces. La demande est ensuite traitée (approuver / rejeter)
-- par un admin_scs depuis /admin/demandes-acces.
--
-- Sécurité :
--   * Rate-limit applicatif côté middleware Next.js (1 demande/IP/heure)
--   * Validation Zod stricte côté Server Action publique
--   * RLS : INSERT public (avec garde-fous), SELECT/UPDATE admin_scs only
--   * Audit RGPD : conservation 90 j rejet ordinaire, 1 an si fraude
--     (à appliquer par tâche planifiée V1.5)
-- =============================================================================

CREATE TYPE public.statut_demande_acces AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.demandes_acces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Données saisies par le demandeur
  email TEXT NOT NULL,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  role_souhaite public.role_utilisateur NOT NULL
    CHECK (role_souhaite IN ('editeur_projet', 'contributeur_partenaire')),
  contexte_souhaite TEXT,        -- texte libre : projets visés ou structure
  justification TEXT NOT NULL,   -- obligatoire : décrit le rôle / contexte

  -- Statut de traitement
  statut public.statut_demande_acces NOT NULL DEFAULT 'pending',
  raison_rejet TEXT,             -- obligatoire si statut = 'rejected'
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id),

  -- Audit & rate-limit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at_ip TEXT,            -- IP source pour audit anti-spam
  consentement_rgpd BOOLEAN NOT NULL DEFAULT FALSE,

  -- Lien post-approbation : si la demande a été convertie en compte,
  -- on garde la trace de l'utilisateur créé.
  utilisateur_cree_id UUID REFERENCES auth.users(id),

  CONSTRAINT chk_demandes_acces_email_format CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT chk_demandes_acces_rejet_raison
    CHECK (statut <> 'rejected' OR raison_rejet IS NOT NULL),
  CONSTRAINT chk_demandes_acces_consentement
    CHECK (consentement_rgpd = TRUE)
);

CREATE INDEX idx_demandes_acces_statut ON public.demandes_acces(statut)
  WHERE statut = 'pending';
CREATE INDEX idx_demandes_acces_email ON public.demandes_acces(lower(email));
CREATE INDEX idx_demandes_acces_created_at ON public.demandes_acces(created_at DESC);

COMMENT ON TABLE public.demandes_acces IS
  'V1-Enrichie-A : demandes d''accès auto-service depuis la page publique /demande-acces. Traitées par admin_scs via /admin/demandes-acces.';

-- =============================================================================
-- RLS : INSERT public (sans auth), SELECT/UPDATE/DELETE admin_scs
-- =============================================================================

ALTER TABLE public.demandes_acces ENABLE ROW LEVEL SECURITY;

-- INSERT : autorisé pour tout visiteur (RLS = anon role)
-- Le rate-limit applicatif (middleware) protège contre l'abus.
-- La contrainte CHECK consentement_rgpd impose le consentement.
CREATE POLICY demandes_acces_insert_public ON public.demandes_acces
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    statut = 'pending'
    AND consentement_rgpd = TRUE
    AND decided_at IS NULL
    AND decided_by IS NULL
    AND utilisateur_cree_id IS NULL
  );

-- SELECT : admin_scs only
CREATE POLICY demandes_acces_select_admin ON public.demandes_acces
  FOR SELECT TO authenticated
  USING (public.is_admin_scs());

-- UPDATE : admin_scs only (pour approuver/rejeter)
CREATE POLICY demandes_acces_update_admin ON public.demandes_acces
  FOR UPDATE TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- DELETE : admin_scs only (purge V1.5 selon politique RGPD)
CREATE POLICY demandes_acces_delete_admin ON public.demandes_acces
  FOR DELETE TO authenticated
  USING (public.is_admin_scs());
