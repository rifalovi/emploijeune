-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 028
-- Table analyses_indicateurs : bloc analytique IA par indicateur CMR
-- -----------------------------------------------------------------------------
-- Chaque indicateur peut avoir UNE analyse IA publiée (la plus récente
-- avec statut='publiee'). Les super_admin génèrent, modifient et publient.
-- Les utilisateurs authentifiés lisent les analyses publiées.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table principale
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analyses_indicateurs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicateur_code TEXT NOT NULL,           -- ex: 'A1', 'B3', ...
  statut          TEXT NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'publiee')),
  contenu         TEXT NOT NULL,           -- texte Markdown généré / édité
  resume          TEXT,                    -- accroche 1 ligne (< 120 car.)
  genere_par_ia   BOOLEAN NOT NULL DEFAULT true,
  modifie_par_sa  BOOLEAN NOT NULL DEFAULT false, -- édité manuellement par super_admin
  prompt_utilise  TEXT,                    -- prompt envoyé à Claude (audit)
  tokens_utilises INTEGER,                 -- coût tokens de la génération
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour requêtes courantes
CREATE INDEX IF NOT EXISTS analyses_indicateurs_code_statut_idx
  ON public.analyses_indicateurs (indicateur_code, statut, updated_at DESC);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.set_analyses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS analyses_indicateurs_updated_at ON public.analyses_indicateurs;
CREATE TRIGGER analyses_indicateurs_updated_at
  BEFORE UPDATE ON public.analyses_indicateurs
  FOR EACH ROW EXECUTE FUNCTION public.set_analyses_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analyses_indicateurs ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié peut lire les analyses publiées
CREATE POLICY "lecture_analyses_publiees"
  ON public.analyses_indicateurs
  FOR SELECT
  TO authenticated
  USING (statut = 'publiee');

-- Super_admin peut tout lire (brouillons inclus)
CREATE POLICY "super_admin_lecture_complete"
  ON public.analyses_indicateurs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Super_admin peut insérer
CREATE POLICY "super_admin_insert"
  ON public.analyses_indicateurs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Super_admin peut modifier
CREATE POLICY "super_admin_update"
  ON public.analyses_indicateurs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Super_admin peut supprimer
CREATE POLICY "super_admin_delete"
  ON public.analyses_indicateurs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fonction RPC : lister_analyses_indicateurs (super_admin)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lister_analyses_indicateurs(
  p_indicateur_code TEXT DEFAULT NULL,
  p_statut TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  indicateur_code TEXT,
  statut TEXT,
  resume TEXT,
  genere_par_ia BOOLEAN,
  modifie_par_sa BOOLEAN,
  tokens_utilises INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
SELECT
  id, indicateur_code, statut, resume,
  genere_par_ia, modifie_par_sa, tokens_utilises,
  created_at, updated_at, published_at
FROM public.analyses_indicateurs
WHERE
  (p_indicateur_code IS NULL OR indicateur_code = p_indicateur_code) AND
  (p_statut IS NULL OR statut = p_statut)
ORDER BY updated_at DESC;
$$;

COMMENT ON TABLE public.analyses_indicateurs IS
  'Analyses IA par indicateur CMR. Générées par Claude, éditées et publiées par super_admin. RLS : lecture des publiées pour tous les authentifiés, écriture super_admin uniquement. Migration 028.';
