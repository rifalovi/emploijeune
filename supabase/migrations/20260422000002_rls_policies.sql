-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 002 : RLS et policies
-- -----------------------------------------------------------------------------
-- Active Row Level Security sur toutes les tables métier et définit les règles
-- d'accès selon les 4 rôles utilisateur :
--   • admin_scs              : accès total
--   • editeur_projet         : lecture + écriture sur les projets de son organisation
--   • contributeur_partenaire : lecture + écriture sur les lignes qu'il a créées
--                              ou qui appartiennent à son organisation
--   • lecteur                : lecture seule, dans son périmètre
-- =============================================================================

-- =============================================================================
-- 1. Fonctions d'aide aux policies (SECURITY DEFINER, stables)
-- =============================================================================

-- Récupère le rôle métier de l'utilisateur courant
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
  LIMIT 1;

  RETURN v_role;
END;
$$;

COMMENT ON FUNCTION public.current_role_metier IS 'Rôle métier de l''utilisateur authentifié ou NULL';

-- Récupère l'organisation de l'utilisateur courant
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
  LIMIT 1;

  RETURN v_org;
END;
$$;

-- Liste des codes projets gérés par l'organisation de l'utilisateur
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
    AND o.actif = TRUE
    AND o.deleted_at IS NULL
  LIMIT 1;

  RETURN COALESCE(v_projets, ARRAY[]::TEXT[]);
END;
$$;

-- Raccourci booléen : l'utilisateur est-il admin SCS ?
CREATE OR REPLACE FUNCTION public.is_admin_scs()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_metier() = 'admin_scs', FALSE);
$$;

-- Vérifie que les champs privilégiés (role, organisation_id, actif) restent
-- identiques à leur valeur actuelle pour l'utilisateur courant.
-- Utilisée par la policy utilisateurs_self_update pour empêcher qu'un utilisateur
-- élève ses propres droits ou change d'organisation.
CREATE OR REPLACE FUNCTION public.utilisateurs_privileges_unchanged(
  p_role public.role_utilisateur,
  p_organisation_id UUID,
  p_actif BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_org UUID;
  v_actif BOOLEAN;
BEGIN
  SELECT role, organisation_id, actif
    INTO v_role, v_org, v_actif
  FROM public.utilisateurs
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN p_role = v_role
     AND p_organisation_id IS NOT DISTINCT FROM v_org
     AND p_actif = v_actif;
END;
$$;

COMMENT ON FUNCTION public.utilisateurs_privileges_unchanged IS
  'Retourne TRUE si les 3 champs privilégiés (role, organisation_id, actif) sont identiques aux valeurs actuelles pour l''utilisateur authentifié';

-- Vérifie l'autorisation de lecture d'un bénéficiaire selon les règles métier.
-- Centralise la logique de périmètre utilisée par plusieurs policies.
CREATE OR REPLACE FUNCTION public.can_read_beneficiaire(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projet TEXT;
  v_org UUID;
  v_created_by UUID;
  v_role public.role_utilisateur;
BEGIN
  SELECT projet_code, organisation_id, created_by
    INTO v_projet, v_org, v_created_by
  FROM public.beneficiaires
  WHERE id = p_id AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF public.is_admin_scs() THEN RETURN TRUE; END IF;

  v_role := public.current_role_metier();
  RETURN (v_role = 'editeur_projet' AND v_projet = ANY(public.current_projets_geres()))
      OR (v_role = 'contributeur_partenaire'
          AND (v_created_by = auth.uid() OR v_org = public.current_organisation_id()))
      OR (v_role = 'lecteur'
          AND (v_org = public.current_organisation_id()
               OR v_projet = ANY(public.current_projets_geres())));
END;
$$;

-- Idem pour une structure.
CREATE OR REPLACE FUNCTION public.can_read_structure(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projet TEXT;
  v_org UUID;
  v_created_by UUID;
  v_role public.role_utilisateur;
BEGIN
  SELECT projet_code, organisation_id, created_by
    INTO v_projet, v_org, v_created_by
  FROM public.structures
  WHERE id = p_id AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF public.is_admin_scs() THEN RETURN TRUE; END IF;

  v_role := public.current_role_metier();
  RETURN (v_role = 'editeur_projet' AND v_projet = ANY(public.current_projets_geres()))
      OR (v_role = 'contributeur_partenaire'
          AND (v_created_by = auth.uid() OR v_org = public.current_organisation_id()))
      OR (v_role = 'lecteur'
          AND (v_org = public.current_organisation_id()
               OR v_projet = ANY(public.current_projets_geres())));
END;
$$;

-- Lecture des réponses D1/D2/D3 rattachées uniquement à un projet (sans cible individuelle).
CREATE OR REPLACE FUNCTION public.can_read_projet(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
BEGIN
  IF p_code IS NULL THEN RETURN FALSE; END IF;
  IF public.is_admin_scs() THEN RETURN TRUE; END IF;

  v_role := public.current_role_metier();
  RETURN v_role IN ('editeur_projet', 'contributeur_partenaire', 'lecteur')
     AND p_code = ANY(public.current_projets_geres());
END;
$$;

-- =============================================================================
-- 2. Activation RLS
-- =============================================================================

-- Tables de référentiel : lecture libre pour tout utilisateur authentifié,
-- écriture réservée aux admin_scs
ALTER TABLE public.programmes_strategiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets_codes_legacy      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pays                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicateurs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domaines_formation        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secteurs_activite         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types_structure           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.natures_appui             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modalites_formation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuts_beneficiaire      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devises                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valeurs_consentement      ENABLE ROW LEVEL SECURITY;

-- Tables métier
ALTER TABLE public.organisations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structures                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reponses_enquetes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports_excel             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journaux_audit            ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Policies — tables de référentiel (lecture libre, écriture admin)
-- =============================================================================

-- Générateur : lecture pour tout authentifié, écriture pour admin_scs
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'programmes_strategiques', 'projets', 'projets_codes_legacy', 'pays', 'indicateurs',
    'domaines_formation', 'secteurs_activite', 'types_structure',
    'natures_appui', 'modalites_formation', 'statuts_beneficiaire',
    'devises', 'valeurs_consentement'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (TRUE)',
                   'ref_' || t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_scs()) WITH CHECK (public.is_admin_scs())',
                   'ref_' || t || '_admin', t);
  END LOOP;
END$$;

-- =============================================================================
-- 4. Policies — organisations & utilisateurs
-- =============================================================================

-- organisations : admin_scs voit et gère tout ; les autres voient leur propre organisation
CREATE POLICY organisations_select ON public.organisations
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR id = public.current_organisation_id()
  );

CREATE POLICY organisations_admin ON public.organisations
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- utilisateurs : admin_scs voit tout ; chacun voit les utilisateurs de sa propre organisation
CREATE POLICY utilisateurs_select ON public.utilisateurs
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR user_id = auth.uid()
    OR organisation_id = public.current_organisation_id()
  );

CREATE POLICY utilisateurs_admin ON public.utilisateurs
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- Auto-mise à jour par l'utilisateur lui-même (uniquement nom_complet en pratique).
-- Les champs privilégiés role / organisation_id / actif sont verrouillés à leur
-- valeur actuelle via la fonction helper — seul admin_scs peut les modifier.
CREATE POLICY utilisateurs_self_update ON public.utilisateurs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.utilisateurs_privileges_unchanged(role, organisation_id, actif)
  );

-- =============================================================================
-- 5. Policies — bénéficiaires (A1)
-- =============================================================================

-- Lecture
CREATE POLICY beneficiaires_select ON public.beneficiaires
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
    OR (
      public.current_role_metier() = 'lecteur'
      AND (organisation_id = public.current_organisation_id()
           OR projet_code = ANY(public.current_projets_geres()))
    )
  );

-- Insertion
CREATE POLICY beneficiaires_insert ON public.beneficiaires
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND organisation_id = public.current_organisation_id()
    )
  );

-- Mise à jour
CREATE POLICY beneficiaires_update ON public.beneficiaires
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
  )
  WITH CHECK (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
  );

-- Suppression physique réservée à l'admin_scs (sinon, utiliser le soft-delete via UPDATE)
CREATE POLICY beneficiaires_delete_admin ON public.beneficiaires
  FOR DELETE TO authenticated
  USING (public.is_admin_scs());

-- =============================================================================
-- 6. Policies — structures (B1) — même logique
-- =============================================================================

CREATE POLICY structures_select ON public.structures
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
    OR (
      public.current_role_metier() = 'lecteur'
      AND (organisation_id = public.current_organisation_id()
           OR projet_code = ANY(public.current_projets_geres()))
    )
  );

CREATE POLICY structures_insert ON public.structures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND organisation_id = public.current_organisation_id()
    )
  );

CREATE POLICY structures_update ON public.structures
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
  )
  WITH CHECK (
    public.is_admin_scs()
    OR (
      public.current_role_metier() = 'editeur_projet'
      AND projet_code = ANY(public.current_projets_geres())
    )
    OR (
      public.current_role_metier() = 'contributeur_partenaire'
      AND (created_by = auth.uid() OR organisation_id = public.current_organisation_id())
    )
  );

CREATE POLICY structures_delete_admin ON public.structures
  FOR DELETE TO authenticated
  USING (public.is_admin_scs());

-- =============================================================================
-- 7. Policies — réponses aux enquêtes
-- =============================================================================

-- Lecture : dérive effectivement des droits sur l'entité liée (bénéficiaire,
-- structure ou projet). Les helpers can_read_* appliquent la même logique de
-- périmètre que les policies beneficiaires_select / structures_select.
CREATE POLICY reponses_select ON public.reponses_enquetes
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR created_by = auth.uid()
    OR (beneficiaire_id IS NOT NULL AND public.can_read_beneficiaire(beneficiaire_id))
    OR (structure_id    IS NOT NULL AND public.can_read_structure(structure_id))
    OR (
      beneficiaire_id IS NULL
      AND structure_id IS NULL
      AND projet_code IS NOT NULL
      AND public.can_read_projet(projet_code)
    )
  );

-- Insertion : autorisée pour les rôles écriture + via formulaires publics (géré par service_role côté API)
CREATE POLICY reponses_insert ON public.reponses_enquetes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
  );

CREATE POLICY reponses_update ON public.reponses_enquetes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_scs()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin_scs()
    OR created_by = auth.uid()
  );

CREATE POLICY reponses_delete_admin ON public.reponses_enquetes
  FOR DELETE TO authenticated
  USING (public.is_admin_scs());

-- =============================================================================
-- 8. Policies — imports Excel
-- =============================================================================

CREATE POLICY imports_select ON public.imports_excel
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR organisation_id = public.current_organisation_id()
    OR created_by = auth.uid()
  );

CREATE POLICY imports_insert ON public.imports_excel
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
  );

CREATE POLICY imports_update ON public.imports_excel
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_scs()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin_scs()
    OR created_by = auth.uid()
  );

-- =============================================================================
-- 9. Policies — journaux d'audit (lecture admin uniquement)
-- =============================================================================

CREATE POLICY audit_select_admin ON public.journaux_audit
  FOR SELECT TO authenticated
  USING (public.is_admin_scs());

-- Pas de policy d'insertion manuelle : l'insertion passe par les triggers SECURITY DEFINER.
-- Pas de policy de modification : le journal est immuable.

-- =============================================================================
-- 10. Droits des rôles PostgreSQL Supabase
-- =============================================================================

-- Les rôles Supabase (anon, authenticated, service_role) héritent des policies ci-dessus.
-- On s'assure qu'ils ont les droits de base sur les tables.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.programmes_strategiques,
                public.projets,
                public.pays,
                public.indicateurs,
                public.domaines_formation,
                public.secteurs_activite,
                public.types_structure,
                public.natures_appui,
                public.modalites_formation,
                public.statuts_beneficiaire,
                public.devises,
                public.valeurs_consentement
        TO anon;
-- projets_codes_legacy : lecture réservée aux utilisateurs authentifiés (pas anon).
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
