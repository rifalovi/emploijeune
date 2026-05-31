-- =============================================================================
-- Migration 20260531000000 — Creation de la table alertes_qualite
-- -----------------------------------------------------------------------------
-- Pourquoi : les alertes qualite sont actuellement calculees a la volee par
--   get_kpis_dashboard_admin_scs() (compteur agrege sans detail par ligne).
--   Pour les phases 2.3 (pays NULL) et 2.4 (pays ZZZ), on a besoin d'une
--   table physique qui stocke chaque anomalie individuellement avec un
--   workflow de resolution (ouvert -> en_cours -> resolu | ignore).
--
-- Decision validee par VIGNON le 31/05/2026.
-- =============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.alertes_qualite (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  type            TEXT NOT NULL,                                -- 'pays_zzz' | 'pays_null' | 'tranche_age_null' | ...
  severite        TEXT NOT NULL DEFAULT 'avertissement',        -- 'info' | 'avertissement' | 'critique'
  statut          TEXT NOT NULL DEFAULT 'ouvert',               -- 'ouvert' | 'en_cours' | 'resolu' | 'ignore'

  -- Cible (XOR : beneficiaire OU structure OU alerte globale)
  beneficiaire_id UUID REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  structure_id    UUID REFERENCES public.structures(id)    ON DELETE CASCADE,
  projet_code     TEXT,
  message         TEXT NOT NULL,

  -- Workflow de resolution
  assigne_a       UUID REFERENCES auth.users(id),
  resolu_par      UUID REFERENCES auth.users(id),
  resolu_le       TIMESTAMPTZ,
  note_resolution TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes de domaine
  CONSTRAINT chk_alertes_statut   CHECK (statut   IN ('ouvert','en_cours','resolu','ignore')),
  CONSTRAINT chk_alertes_severite CHECK (severite IN ('info','avertissement','critique')),

  -- Une alerte cible soit un beneficiaire, soit une structure, soit aucun (globale).
  CONSTRAINT chk_alertes_cible CHECK (
    NOT (beneficiaire_id IS NOT NULL AND structure_id IS NOT NULL)
  )
);

-- Unicite : une seule alerte de meme type par cible.
-- Index partiels (les NULL ne participent pas -> pas de faux positifs).
CREATE UNIQUE INDEX uq_alertes_qualite_benef
  ON public.alertes_qualite (type, beneficiaire_id)
  WHERE beneficiaire_id IS NOT NULL;

CREATE UNIQUE INDEX uq_alertes_qualite_struct
  ON public.alertes_qualite (type, structure_id)
  WHERE structure_id IS NOT NULL;

-- Index de consultation courante
CREATE INDEX idx_alertes_qualite_statut       ON public.alertes_qualite (statut);
CREATE INDEX idx_alertes_qualite_type         ON public.alertes_qualite (type);
CREATE INDEX idx_alertes_qualite_beneficiaire ON public.alertes_qualite (beneficiaire_id) WHERE beneficiaire_id IS NOT NULL;
CREATE INDEX idx_alertes_qualite_structure    ON public.alertes_qualite (structure_id)    WHERE structure_id IS NOT NULL;

-- ── Trigger updated_at (reutilise la fonction existante) ─────────────────────

CREATE TRIGGER trg_alertes_qualite_upd
  BEFORE UPDATE ON public.alertes_qualite
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.alertes_qualite ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifies
CREATE POLICY alertes_qualite_select
  ON public.alertes_qualite FOR SELECT TO authenticated
  USING (TRUE);

-- Ecriture : admin_scs et super_admin uniquement
CREATE POLICY alertes_qualite_admin
  ON public.alertes_qualite FOR ALL TO authenticated
  USING  (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- ── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT ON public.alertes_qualite TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.alertes_qualite TO authenticated;
