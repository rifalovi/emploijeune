-- =============================================================================
-- Migration 20260601000001 — Phase 4 etape 1 : tranches d'age precises
-- -----------------------------------------------------------------------------
-- Pourquoi : les indicateurs OIF utilisent deux categories larges
--   (Jeune 15-34 / Adulte 35+). Pour les analyses fines et la collecte
--   publique, on a besoin de tranches plus granulaires (15-17, 18-24, etc.).
--   Ces tranches COMPLETENT Jeune/Adulte, ne les remplacent pas.
--   Chaque tranche precise est rattachee a une categorie OIF via
--   categorie_oif, ce qui garantit la coherence avec les indicateurs
--   institutionnels.
--
-- Decision validee par VIGNON le 31/05/2026.
-- =============================================================================


-- ── 1. Table tranches_age_precises ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tranches_age_precises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle         TEXT NOT NULL UNIQUE,
  borne_min       INT,                              -- NULL = open-ended bas
  borne_max       INT,                              -- NULL = open-ended haut
  categorie_oif   TEXT NOT NULL,
  ordre           INT NOT NULL DEFAULT 0,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_categorie_oif CHECK (categorie_oif IN ('Jeune', 'Adulte')),
  CONSTRAINT chk_bornes_coherentes CHECK (
    borne_min IS NULL OR borne_max IS NULL OR borne_min <= borne_max
  )
);

CREATE INDEX IF NOT EXISTS idx_tranches_age_actif_ordre
  ON public.tranches_age_precises (actif, ordre);

-- ── Trigger updated_at (reutilise la fonction existante) ─────────────────────

CREATE TRIGGER trg_tranches_age_upd
  BEFORE UPDATE ON public.tranches_age_precises
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.tranches_age_precises ENABLE ROW LEVEL SECURITY;

-- SELECT ouvert (anon pour collecte publique + authenticated)
CREATE POLICY tranches_age_select
  ON public.tranches_age_precises FOR SELECT TO anon, authenticated
  USING (TRUE);

-- INSERT/UPDATE/DELETE super_admin uniquement
CREATE POLICY tranches_age_admin
  ON public.tranches_age_precises FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT ON public.tranches_age_precises TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tranches_age_precises TO authenticated;


-- ── 2. Seed initial (idempotent) ────────────────────────────────────────────

INSERT INTO public.tranches_age_precises
  (libelle, borne_min, borne_max, categorie_oif, ordre)
VALUES
  ('15-17 ans', 15, 17, 'Jeune', 1),
  ('18-24 ans', 18, 24, 'Jeune', 2),
  ('25-34 ans', 25, 34, 'Jeune', 3),
  ('35-44 ans', 35, 44, 'Adulte', 4),
  ('45-54 ans', 45, 54, 'Adulte', 5),
  ('55 ans et +', 55, NULL, 'Adulte', 6)
ON CONFLICT (libelle) DO NOTHING;


-- ── 3. FK sur beneficiaires ─────────────────────────────────────────────────

ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS tranche_age_precise_id UUID
  REFERENCES public.tranches_age_precises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_beneficiaires_tranche_precise
  ON public.beneficiaires (tranche_age_precise_id)
  WHERE tranche_age_precise_id IS NOT NULL;
