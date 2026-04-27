-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 014 : modèle d'affectation projets
-- -----------------------------------------------------------------------------
-- Refactor architectural : on remplace l'héritage indirect projets → utilisateur
-- via organisations.projets_geres TEXT[] par une vraie liaison utilisateur ↔
-- projet, avec historique complet des transferts (RGPD, audit, gouvernance).
--
-- 3 nouvelles tables :
--   • affectation_projet_courante    : qui gère un projet AUJOURD'HUI
--   • affectation_projet_historique  : tous les flux passés (transferts, retraits)
--   • structure_projet_historique    : historique des projets de financement
--                                       d'une structure (B1)
--
-- 1 fonction refactorée :
--   • current_projets_geres()  ← lit depuis les nouvelles tables au lieu de
--     organisations.projets_geres (qui devient legacy, sera droppée en V1.5)
--
-- Les 20 RLS policies et les 4 fonctions KPI restent INCHANGÉES : elles
-- délèguent toutes à current_projets_geres() qui conserve sa signature
-- (TEXT[]) — donc la migration est transparente pour le reste du système.
--
-- Migration de données automatique en fin de fichier : tous les editeur_projet
-- existants reçoivent une affectation pour chacun des projets gérés par leur
-- organisation (snapshot V1).
-- =============================================================================

-- =============================================================================
-- 1. Tables
-- =============================================================================

-- 1.1. affectation_projet_courante : état actuel des affectations
CREATE TABLE public.affectation_projet_courante (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_code TEXT NOT NULL REFERENCES public.projets(code),
  role_dans_projet TEXT NOT NULL DEFAULT 'gestionnaire_principal'
    CHECK (role_dans_projet IN ('gestionnaire_principal', 'co_gestionnaire')),
  date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attribue_par UUID REFERENCES auth.users(id),
  raison_debut TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, projet_code)
);

CREATE INDEX idx_affectation_courante_user ON public.affectation_projet_courante(user_id);
CREATE INDEX idx_affectation_courante_projet ON public.affectation_projet_courante(projet_code);

COMMENT ON TABLE public.affectation_projet_courante IS
  'Affectations utilisateur ↔ projet actuellement actives. Une ligne = un coordonnateur gère un projet aujourd''hui. Un retrait DELETE la ligne et UPDATE date_fin dans l''historique.';

-- 1.2. affectation_projet_historique : tous les flux (immuable hors date_fin)
CREATE TABLE public.affectation_projet_historique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  projet_code TEXT NOT NULL REFERENCES public.projets(code),
  role_dans_projet TEXT NOT NULL,
  date_debut TIMESTAMPTZ NOT NULL,
  date_fin TIMESTAMPTZ,
  attribue_par UUID REFERENCES auth.users(id),
  transfere_par UUID REFERENCES auth.users(id),
  transfere_a UUID REFERENCES auth.users(id),
  raison_debut TEXT,
  raison_fin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affectation_historique_user ON public.affectation_projet_historique(user_id);
CREATE INDEX idx_affectation_historique_projet ON public.affectation_projet_historique(projet_code);
CREATE INDEX idx_affectation_historique_debut ON public.affectation_projet_historique(date_debut DESC);
CREATE INDEX idx_affectation_historique_actives
  ON public.affectation_projet_historique(user_id, projet_code)
  WHERE date_fin IS NULL;

COMMENT ON TABLE public.affectation_projet_historique IS
  'Journal immuable des affectations utilisateur ↔ projet (passées + actives). date_fin IS NULL = ligne miroir d''une affectation courante. Renseignée à la clôture.';

-- 1.3. structure_projet_historique : historique des projets d'une structure (B1)
CREATE TABLE public.structure_projet_historique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES public.structures(id) ON DELETE CASCADE,
  projet_code TEXT NOT NULL REFERENCES public.projets(code),
  date_debut_financement TIMESTAMPTZ NOT NULL,
  date_fin_financement TIMESTAMPTZ,
  motif_changement TEXT,
  enregistre_par UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_structure_projet_hist_struct ON public.structure_projet_historique(structure_id);
CREATE INDEX idx_structure_projet_hist_projet ON public.structure_projet_historique(projet_code);
CREATE INDEX idx_structure_projet_hist_actives
  ON public.structure_projet_historique(structure_id)
  WHERE date_fin_financement IS NULL;

COMMENT ON TABLE public.structure_projet_historique IS
  'Historique des projets de financement d''une structure. structures.projet_code conserve le projet COURANT, ce journal trace les changements.';

-- =============================================================================
-- 2. Triggers (updated_at + audit)
-- =============================================================================

CREATE TRIGGER trg_affectation_courante_upd
  BEFORE UPDATE ON public.affectation_projet_courante
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_affectation_courante_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.affectation_projet_courante
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TRIGGER trg_affectation_historique_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.affectation_projet_historique
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TRIGGER trg_structure_projet_hist_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.structure_projet_historique
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =============================================================================
-- 3. RLS — admin seulement en écriture, lecture restreinte au user concerné
-- =============================================================================

ALTER TABLE public.affectation_projet_courante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affectation_projet_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_projet_historique ENABLE ROW LEVEL SECURITY;

-- affectation_projet_courante : admin total ; chacun voit ses propres
-- affectations + celles des utilisateurs de son organisation (visibilité équipe)
CREATE POLICY affectation_courante_select ON public.affectation_projet_courante
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.utilisateurs u_target
      JOIN public.utilisateurs u_self ON u_self.user_id = auth.uid()
      WHERE u_target.user_id = affectation_projet_courante.user_id
        AND u_target.organisation_id IS NOT NULL
        AND u_target.organisation_id = u_self.organisation_id
    )
  );

CREATE POLICY affectation_courante_admin ON public.affectation_projet_courante
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- affectation_projet_historique : admin total + lecture du sien
CREATE POLICY affectation_historique_select ON public.affectation_projet_historique
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR user_id = auth.uid()
  );

CREATE POLICY affectation_historique_admin ON public.affectation_projet_historique
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- structure_projet_historique : lecture si l'utilisateur peut lire la structure
CREATE POLICY structure_projet_hist_select ON public.structure_projet_historique
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR public.can_read_structure(structure_id)
  );

CREATE POLICY structure_projet_hist_admin ON public.structure_projet_historique
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- =============================================================================
-- 4. Refactor current_projets_geres() — nouvelle source de vérité
-- =============================================================================
--
-- Comportement par rôle :
--   • admin_scs               → tous les codes projets (référentiel public.projets)
--   • editeur_projet          → ses propres affectations courantes
--   • contributeur_partenaire → projets distincts des structures de son organisation
--   • lecteur                 → projets distincts des affectations des coordonnateurs
--                                de la même organisation
--
-- Signature inchangée (TEXT[]) → les 20 RLS policies + 4 fonctions KPI continuent
-- à fonctionner sans modification.

CREATE OR REPLACE FUNCTION public.current_projets_geres()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role public.role_utilisateur;
  v_org UUID;
  v_projets TEXT[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid
    AND actif = TRUE
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_role IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  IF v_role = 'admin_scs' THEN
    SELECT COALESCE(array_agg(code), ARRAY[]::TEXT[])
      INTO v_projets
      FROM public.projets;
    RETURN v_projets;
  END IF;

  IF v_role = 'editeur_projet' THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[])
      INTO v_projets
      FROM public.affectation_projet_courante
      WHERE user_id = v_uid;
    RETURN v_projets;
  END IF;

  IF v_role = 'contributeur_partenaire' AND v_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT projet_code), ARRAY[]::TEXT[])
      INTO v_projets
      FROM public.structures
      WHERE organisation_id = v_org
        AND deleted_at IS NULL;
    RETURN v_projets;
  END IF;

  IF v_role = 'lecteur' AND v_org IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT a.projet_code), ARRAY[]::TEXT[])
      INTO v_projets
      FROM public.affectation_projet_courante a
      JOIN public.utilisateurs u ON u.user_id = a.user_id
      WHERE u.organisation_id = v_org
        AND u.actif = TRUE
        AND u.deleted_at IS NULL;
    RETURN v_projets;
  END IF;

  RETURN ARRAY[]::TEXT[];
END;
$$;

COMMENT ON FUNCTION public.current_projets_geres IS
  'Codes projets accessibles à l''utilisateur courant. Source : affectation_projet_courante (editeur_projet) ; structures.projet_code de l''org (partenaire) ; héritage depuis coordonnateurs de l''org (lecteur). admin_scs reçoit tous les projets.';

-- =============================================================================
-- 5. Migration des données existantes
-- -----------------------------------------------------------------------------
-- Tous les editeur_projet actifs reçoivent une affectation pour chacun des
-- projets gérés par leur organisation. La table historique garde une trace
-- de cette migration (raison_debut explicite).
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  v_admin_id UUID;
BEGIN
  -- Premier admin_scs disponible pour la trace "attribué_par"
  SELECT user_id INTO v_admin_id
  FROM public.utilisateurs
  WHERE role = 'admin_scs' AND actif = TRUE AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  -- Affectations pour les editeur_projet actifs avec organisation
  FOR r IN
    SELECT u.user_id, o.projets_geres
    FROM public.utilisateurs u
    JOIN public.organisations o ON o.id = u.organisation_id
    WHERE u.role = 'editeur_projet'
      AND u.actif = TRUE
      AND u.deleted_at IS NULL
      AND o.actif = TRUE
      AND o.deleted_at IS NULL
      AND o.projets_geres IS NOT NULL
      AND array_length(o.projets_geres, 1) > 0
  LOOP
    INSERT INTO public.affectation_projet_courante
      (user_id, projet_code, role_dans_projet, date_debut, attribue_par, raison_debut)
    SELECT
      r.user_id,
      p.code,
      'gestionnaire_principal',
      NOW(),
      v_admin_id,
      'Migration initiale depuis modèle organisations.projets_geres'
    FROM unnest(r.projets_geres) AS p_code
    JOIN public.projets p ON p.code = p_code
    ON CONFLICT (user_id, projet_code) DO NOTHING;
  END LOOP;

  -- Miroir dans l'historique (date_fin IS NULL = ligne active)
  INSERT INTO public.affectation_projet_historique
    (user_id, projet_code, role_dans_projet, date_debut, attribue_par, raison_debut)
  SELECT user_id, projet_code, role_dans_projet, date_debut, attribue_par, raison_debut
  FROM public.affectation_projet_courante;

  -- Historique structures : une ligne par structure existante
  INSERT INTO public.structure_projet_historique
    (structure_id, projet_code, date_debut_financement, motif_changement)
  SELECT id, projet_code, COALESCE(created_at, NOW()),
         'Migration initiale depuis V1 (projet courant unique)'
  FROM public.structures
  WHERE deleted_at IS NULL;
END$$;

-- =============================================================================
-- 6. GRANTS
-- =============================================================================

GRANT ALL ON public.affectation_projet_courante TO authenticated, service_role;
GRANT ALL ON public.affectation_projet_historique TO authenticated, service_role;
GRANT ALL ON public.structure_projet_historique TO authenticated, service_role;
