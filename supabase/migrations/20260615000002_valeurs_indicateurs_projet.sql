-- =============================================================================
-- Migration — Valeurs d'indicateurs PAR PROJET (extension du niveau « ensemble »)
-- -----------------------------------------------------------------------------
-- Les valeurs « ensemble » (tous projets) sont stockées dans
-- `valeurs_indicateurs_saisies` (clé indicateur+année). Cette table ajoute la
-- DIMENSION PROJET sans toucher au système existant : un rapport d'enquête
-- détaille souvent chaque indicateur par projet (P14, P16a, P19, P20…).
--
-- Approche additive : aucune RPC de calcul existante n'est modifiée. L'écriture
-- passe par le service_role (Server Action super_admin) ; la lecture est
-- ouverte aux authentifiés (filtrage brouillon/publié côté requête).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.valeurs_indicateurs_projet (
  indicateur_code TEXT NOT NULL,
  /** Code projet OIF (PROJ_A14, PROJ_A16a, …). */
  projet_code     TEXT NOT NULL,
  annee           INTEGER NOT NULL,
  /** Valeur (pour un taux : le pourcentage ; pour un effectif : le nombre). */
  valeur_directe  NUMERIC,
  note            TEXT,
  publie          BOOLEAN NOT NULL DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (indicateur_code, projet_code, annee)
);

CREATE INDEX IF NOT EXISTS idx_valeurs_indic_projet_code
  ON public.valeurs_indicateurs_projet(indicateur_code, annee);
CREATE INDEX IF NOT EXISTS idx_valeurs_indic_projet_publie
  ON public.valeurs_indicateurs_projet(indicateur_code, publie);

COMMENT ON TABLE public.valeurs_indicateurs_projet IS
  'Valeurs d''indicateurs ventilées par projet (complément du niveau ensemble valeurs_indicateurs_saisies). Écriture super_admin via service_role.';

ALTER TABLE public.valeurs_indicateurs_projet ENABLE ROW LEVEL SECURITY;

CREATE POLICY valeurs_indic_projet_read ON public.valeurs_indicateurs_projet
  FOR SELECT TO authenticated USING (true);

CREATE POLICY valeurs_indic_projet_write ON public.valeurs_indicateurs_projet
  FOR ALL TO authenticated
  USING (public.is_admin_scs() OR public.current_role_metier() = 'super_admin')
  WITH CHECK (public.is_admin_scs() OR public.current_role_metier() = 'super_admin');

GRANT ALL ON public.valeurs_indicateurs_projet TO authenticated, service_role;
