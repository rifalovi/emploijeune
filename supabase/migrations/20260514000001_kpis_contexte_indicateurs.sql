-- Migration : table kpis_contexte_indicateurs
-- Stocke les KPIs secondaires saisissables par indicateur (pays couverts,
-- femmes, jeunes, adultes, participants, sources de financement…) qui sont
-- affichés dans la page publique Réalisations mais ne proviennent pas encore
-- de la collecte automatique.
-- Une seule ligne par indicateur (pas de dimension année — valeur globale de
-- présentation).

CREATE TABLE IF NOT EXISTS public.kpis_contexte_indicateurs (
  indicateur_code     TEXT        PRIMARY KEY,
  pays_count          INTEGER     CHECK (pays_count >= 0),
  femmes_count        INTEGER     CHECK (femmes_count >= 0),
  nb_jeunes           INTEGER     CHECK (nb_jeunes >= 0),
  nb_adultes          INTEGER     CHECK (nb_adultes >= 0),
  -- Score (A4)
  participants_count  INTEGER     CHECK (participants_count >= 0),
  ayant_progresse     INTEGER     CHECK (ayant_progresse >= 0),
  gain_moyen          INTEGER     CHECK (gain_moyen >= 0),
  -- Montant (B4)
  sources_public_pct  INTEGER     CHECK (sources_public_pct BETWEEN 0 AND 100),
  sources_prive_pct   INTEGER     CHECK (sources_prive_pct BETWEEN 0 AND 100),
  -- Méta
  note                TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Activer RLS
ALTER TABLE public.kpis_contexte_indicateurs ENABLE ROW LEVEL SECURITY;

-- Lecture publique (page Réalisations accessible sans connexion)
CREATE POLICY kpis_contexte_read ON public.kpis_contexte_indicateurs
  FOR SELECT USING (true);

-- Écriture réservée admin_scs + super_admin
CREATE POLICY kpis_contexte_write ON public.kpis_contexte_indicateurs
  FOR ALL
  USING ((auth.jwt() ->> 'role') IN ('admin_scs', 'super_admin'))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('admin_scs', 'super_admin'));

-- Droits
GRANT SELECT ON public.kpis_contexte_indicateurs TO anon;
GRANT ALL   ON public.kpis_contexte_indicateurs TO authenticated, service_role;
