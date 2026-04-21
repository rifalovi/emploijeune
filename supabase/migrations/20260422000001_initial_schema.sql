-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 001 : schéma initial
-- -----------------------------------------------------------------------------
-- Crée les tables de référence (nomenclatures), les tables métier (A1 bénéficiaires,
-- B1 structures, enquêtes, imports, audit) et les déclencheurs de cohérence.
-- Les RLS et policies sont activées dans la migration 002.
-- =============================================================================

-- Extensions requises ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;     -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;      -- recherche textuelle
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;     -- normalisation accents

-- Fonctions utilitaires -------------------------------------------------------

-- Met à jour le champ updated_at sur UPDATE
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Wrapper IMMUTABLE autour de unaccent() pour pouvoir l'utiliser dans des index
-- fonctionnels. unaccent() de base est STABLE car il lit un dictionnaire ; on
-- garantit contractuellement ici qu'il sera traité comme immutable.
CREATE OR REPLACE FUNCTION public.unaccent_immutable(TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$;

-- =============================================================================
-- 1. TABLES DE RÉFÉRENTIEL (nomenclatures)
-- =============================================================================

-- 1.1. Programmes Stratégiques (PS1, PS2, PS3) ---------------------------------
CREATE TABLE public.programmes_strategiques (
  code TEXT PRIMARY KEY CHECK (code ~ '^PS[0-9]+$'),
  libelle TEXT NOT NULL,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE public.programmes_strategiques IS 'Programmes Stratégiques officiels de l''OIF (PS1, PS2, PS3)';

-- 1.2. Projets OIF (PROJ_A01a à PROJ_A20) --------------------------------------
CREATE TABLE public.projets (
  code TEXT PRIMARY KEY CHECK (code ~ '^PROJ_A[0-9]{2}[a-z]?$'),
  libelle TEXT NOT NULL,
  programme_strategique TEXT NOT NULL REFERENCES public.programmes_strategiques(code),
  concerne_emploi_jeunes BOOLEAN NOT NULL DEFAULT FALSE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE public.projets IS 'Nomenclature officielle des 22 projets OIF (PROJ_A01a à PROJ_A20)';
COMMENT ON COLUMN public.projets.concerne_emploi_jeunes IS 'TRUE pour les 8 projets directement suivis par la plateforme emploi jeunes';

-- 1.2.bis. Table de correspondance pour rétro-compatibilité des anciens codes --
CREATE TABLE public.projets_codes_legacy (
  code_legacy TEXT PRIMARY KEY,
  code_officiel TEXT NOT NULL REFERENCES public.projets(code),
  remplace_au TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.projets_codes_legacy IS 'Correspondance anciens codes projets (P14, P16a, PEJ…) vers codes officiels PROJ_A*. Utilisée par le parser d''import Excel pour remapper avec avertissement de traçabilité, sans erreur bloquante.';

-- 1.3. Pays (codes ISO-3 Francophonie) -----------------------------------------
CREATE TABLE public.pays (
  code_iso TEXT PRIMARY KEY CHECK (code_iso ~ '^[A-Z]{3}$'),
  libelle_fr TEXT NOT NULL,
  region TEXT,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.pays IS 'Pays de la Francophonie — codes ISO-3 issus du Template V1. NOTE : certains pays membres/observateurs OIF manquent dans cette liste initiale (THA Thaïlande, CYP Chypre, QAT Qatar, ARE Émirats arabes unis, etc.) — à compléter par l''admin SCS via l''UI d''administration.';

-- 1.4. Indicateurs du cadre de mesure (A1..F1) ---------------------------------
CREATE TABLE public.indicateurs (
  code TEXT PRIMARY KEY CHECK (code ~ '^[ABCDF][0-9]+$'),
  categorie TEXT NOT NULL CHECK (categorie IN ('A', 'B', 'C', 'D', 'F')),
  libelle TEXT NOT NULL,
  definition TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  methode_collecte TEXT,
  formule_calcul TEXT,
  sources TEXT,
  frequence TEXT,
  precautions TEXT,
  projets_concernes TEXT[] NOT NULL DEFAULT '{}',
  est_pivot BOOLEAN NOT NULL DEFAULT FALSE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE public.indicateurs IS 'Les 18 indicateurs du cadre de mesure du rendement V2';
COMMENT ON COLUMN public.indicateurs.est_pivot IS 'TRUE pour A1 et B1 (indicateurs-pivots constituant les bases de sondage)';

-- 1.5. Domaines de formation (nomenclature template V1 feuille 5) --------------
CREATE TABLE public.domaines_formation (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.6. Secteurs d'activité -----------------------------------------------------
CREATE TABLE public.secteurs_activite (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.7. Types de structure ------------------------------------------------------
CREATE TABLE public.types_structure (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.8. Natures d'appui ---------------------------------------------------------
CREATE TABLE public.natures_appui (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.9. Modalités de formation --------------------------------------------------
CREATE TABLE public.modalites_formation (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.10. Statuts bénéficiaire ---------------------------------------------------
CREATE TABLE public.statuts_beneficiaire (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.11. Devises ----------------------------------------------------------------
CREATE TABLE public.devises (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$' OR code = 'Autre'),
  libelle TEXT NOT NULL,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.12. Consentements RGPD (valeurs fermées) -----------------------------------
CREATE TABLE public.valeurs_consentement (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL,
  recueilli BOOLEAN NOT NULL,
  ordre_affichage SMALLINT NOT NULL DEFAULT 0
);

-- =============================================================================
-- 2. TABLES MÉTIER
-- =============================================================================

-- 2.1. Organisations (OIF SCS, unités chefs de file, partenaires) --------------
CREATE TYPE public.type_organisation AS ENUM (
  'scs',
  'unite_chef_file',
  'partenaire_mise_en_oeuvre',
  'autre'
);

CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type public.type_organisation NOT NULL,
  pays_code TEXT REFERENCES public.pays(code_iso),
  email_contact TEXT,
  telephone_contact TEXT,
  projets_geres TEXT[] NOT NULL DEFAULT '{}',
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_organisations_type ON public.organisations(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_organisations_pays ON public.organisations(pays_code) WHERE deleted_at IS NULL;

-- 2.2. Utilisateurs (liaison auth.users ↔ métier) ------------------------------
CREATE TYPE public.role_utilisateur AS ENUM (
  'admin_scs',
  'editeur_projet',
  'contributeur_partenaire',
  'lecteur'
);

CREATE TABLE public.utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_complet TEXT NOT NULL,
  organisation_id UUID REFERENCES public.organisations(id),
  role public.role_utilisateur NOT NULL DEFAULT 'lecteur',
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_utilisateurs_organisation ON public.utilisateurs(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_utilisateurs_role ON public.utilisateurs(role) WHERE deleted_at IS NULL;

-- 2.3. Bénéficiaires individuels — indicateur A1 -------------------------------
CREATE TYPE public.sexe AS ENUM ('F', 'M', 'Autre');

CREATE TYPE public.source_import AS ENUM (
  'manuelle',
  'excel_v1',
  'excel_v2',
  'formulaire_web',
  'api'
);

CREATE TABLE public.beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  sexe public.sexe NOT NULL,
  date_naissance DATE,

  -- Rattachement
  projet_code TEXT NOT NULL REFERENCES public.projets(code),
  pays_code TEXT NOT NULL REFERENCES public.pays(code_iso),
  organisation_id UUID REFERENCES public.organisations(id),
  partenaire_accompagnement TEXT,

  -- Formation
  domaine_formation_code TEXT NOT NULL REFERENCES public.domaines_formation(code),
  intitule_formation TEXT,
  modalite_formation_code TEXT REFERENCES public.modalites_formation(code),
  annee_formation SMALLINT NOT NULL CHECK (annee_formation BETWEEN 2000 AND 2100),
  date_debut_formation DATE,
  date_fin_formation DATE,
  statut_code TEXT NOT NULL REFERENCES public.statuts_beneficiaire(code),
  fonction_actuelle TEXT,

  -- RGPD & contacts
  consentement_recueilli BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_date DATE,
  telephone TEXT,
  courriel TEXT,
  localite_residence TEXT,
  commentaire TEXT,

  -- Traçabilité import
  source_import public.source_import NOT NULL DEFAULT 'manuelle',
  import_batch_id UUID,
  identifiant_externe TEXT,

  -- Métadonnées techniques
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Règle RGPD : contacts uniquement si consentement recueilli
  CONSTRAINT chk_beneficiaires_rgpd CHECK (
    consentement_recueilli = TRUE
    OR (telephone IS NULL AND courriel IS NULL)
  ),
  -- Au moins un canal de contact si consentement recueilli
  CONSTRAINT chk_beneficiaires_contact_si_consentement CHECK (
    consentement_recueilli = FALSE
    OR telephone IS NOT NULL
    OR courriel IS NOT NULL
  ),
  CONSTRAINT chk_beneficiaires_dates_formation CHECK (
    date_debut_formation IS NULL
    OR date_fin_formation IS NULL
    OR date_debut_formation <= date_fin_formation
  )
);

CREATE INDEX idx_beneficiaires_projet ON public.beneficiaires(projet_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_pays ON public.beneficiaires(pays_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_annee ON public.beneficiaires(annee_formation) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_domaine ON public.beneficiaires(domaine_formation_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_statut ON public.beneficiaires(statut_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_organisation ON public.beneficiaires(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_import_batch ON public.beneficiaires(import_batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_beneficiaires_recherche
  ON public.beneficiaires
  USING gin ((public.unaccent_immutable(nom) || ' ' || public.unaccent_immutable(prenom)) gin_trgm_ops)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_beneficiaires_dedoublonnage
  ON public.beneficiaires (lower(public.unaccent_immutable(prenom)), lower(public.unaccent_immutable(nom)), date_naissance, projet_code)
  WHERE deleted_at IS NULL AND date_naissance IS NOT NULL;

COMMENT ON TABLE public.beneficiaires IS 'Indicateur A1 — jeunes formés, univers nominatif pour les enquêtes A2..F1';

-- 2.4. Structures économiques — indicateur B1 ----------------------------------
CREATE TYPE public.statut_structure AS ENUM (
  'creation',
  'renforcement',
  'relance'
);

CREATE TABLE public.structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité
  nom_structure TEXT NOT NULL,
  type_structure_code TEXT NOT NULL REFERENCES public.types_structure(code),
  secteur_activite_code TEXT NOT NULL REFERENCES public.secteurs_activite(code),
  secteur_precis TEXT,
  intitule_initiative TEXT,
  date_creation DATE,
  statut_creation public.statut_structure NOT NULL,

  -- Rattachement
  projet_code TEXT NOT NULL REFERENCES public.projets(code),
  pays_code TEXT NOT NULL REFERENCES public.pays(code_iso),
  organisation_id UUID REFERENCES public.organisations(id),

  -- Porteur
  porteur_prenom TEXT,
  porteur_nom TEXT NOT NULL,
  porteur_sexe public.sexe NOT NULL,
  porteur_date_naissance DATE,

  -- Appui
  annee_appui SMALLINT NOT NULL CHECK (annee_appui BETWEEN 2000 AND 2100),
  nature_appui_code TEXT NOT NULL REFERENCES public.natures_appui(code),
  montant_appui NUMERIC(14, 2),
  devise_code TEXT REFERENCES public.devises(code),

  -- RGPD & contacts
  consentement_recueilli BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_date DATE,
  telephone_porteur TEXT,
  courriel_porteur TEXT,
  localite TEXT,
  latitude NUMERIC(9, 6) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9, 6) CHECK (longitude BETWEEN -180 AND 180),
  commentaire TEXT,

  -- Traçabilité import
  source_import public.source_import NOT NULL DEFAULT 'manuelle',
  import_batch_id UUID,
  identifiant_externe TEXT,

  -- Métadonnées techniques
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_structures_rgpd CHECK (
    consentement_recueilli = TRUE
    OR (telephone_porteur IS NULL AND courriel_porteur IS NULL)
  ),
  CONSTRAINT chk_structures_montant_devise CHECK (
    montant_appui IS NULL OR devise_code IS NOT NULL
  )
);

CREATE INDEX idx_structures_projet ON public.structures(projet_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_pays ON public.structures(pays_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_secteur ON public.structures(secteur_activite_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_type ON public.structures(type_structure_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_annee ON public.structures(annee_appui) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_organisation ON public.structures(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_import_batch ON public.structures(import_batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_structures_recherche
  ON public.structures
  USING gin (public.unaccent_immutable(nom_structure) gin_trgm_ops)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_structures_dedoublonnage
  ON public.structures (lower(public.unaccent_immutable(nom_structure)), pays_code, projet_code)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.structures IS 'Indicateur B1 — activités économiques appuyées, univers pour enquêtes B2..B4';

-- 2.5. Réponses aux enquêtes ---------------------------------------------------
CREATE TYPE public.vague_enquete AS ENUM (
  '6_mois',
  '12_mois',
  '24_mois',
  'ponctuelle',
  'avant_formation',
  'fin_formation'
);

CREATE TYPE public.canal_collecte AS ENUM (
  'formulaire_web',
  'entretien',
  'telephone',
  'import',
  'email',
  'sms',
  'whatsapp'
);

CREATE TABLE public.reponses_enquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicateur_code TEXT NOT NULL REFERENCES public.indicateurs(code),
  beneficiaire_id UUID REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,
  -- Rattachement projet explicite, obligatoire pour les indicateurs D1/D2/D3
  -- qui ne ciblent ni bénéficiaire ni structure.
  projet_code TEXT REFERENCES public.projets(code),
  donnees JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_collecte DATE NOT NULL DEFAULT CURRENT_DATE,
  vague_enquete public.vague_enquete NOT NULL DEFAULT 'ponctuelle',
  canal_collecte public.canal_collecte NOT NULL DEFAULT 'formulaire_web',
  agent_collecte UUID REFERENCES auth.users(id),
  lien_public_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Une réponse cible soit un bénéficiaire, soit une structure, soit un projet
  -- (cas D1/D2/D3 : revue documentaire, études de cas, effets écosystèmes).
  CONSTRAINT chk_reponses_cible CHECK (
    (beneficiaire_id IS NOT NULL AND structure_id IS NULL)
    OR (beneficiaire_id IS NULL AND structure_id IS NOT NULL)
    OR (beneficiaire_id IS NULL AND structure_id IS NULL AND projet_code IS NOT NULL)
  )
);
CREATE INDEX idx_reponses_indicateur ON public.reponses_enquetes(indicateur_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_reponses_beneficiaire ON public.reponses_enquetes(beneficiaire_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reponses_structure ON public.reponses_enquetes(structure_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reponses_projet ON public.reponses_enquetes(projet_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_reponses_vague ON public.reponses_enquetes(vague_enquete, date_collecte) WHERE deleted_at IS NULL;
CREATE INDEX idx_reponses_donnees ON public.reponses_enquetes USING gin (donnees);

COMMENT ON TABLE public.reponses_enquetes IS 'Stockage souple des réponses aux enquêtes A2..F1 (donnees JSONB validée côté application par schémas Zod)';

-- 2.6. Imports Excel (traçabilité) ---------------------------------------------
CREATE TYPE public.statut_import AS ENUM (
  'en_cours',
  'succes',
  'echec_partiel',
  'echec_total',
  'annule'
);

CREATE TABLE public.imports_excel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fichier_nom TEXT NOT NULL,
  fichier_taille_octets BIGINT,
  fichier_hash_sha256 TEXT,
  organisation_id UUID REFERENCES public.organisations(id),
  projet_code TEXT REFERENCES public.projets(code),
  version_template TEXT NOT NULL DEFAULT 'V1',
  nb_lignes_a1 INTEGER NOT NULL DEFAULT 0,
  nb_lignes_b1 INTEGER NOT NULL DEFAULT 0,
  nb_lignes_inserees INTEGER NOT NULL DEFAULT 0,
  nb_lignes_mises_a_jour INTEGER NOT NULL DEFAULT 0,
  nb_erreurs INTEGER NOT NULL DEFAULT 0,
  nb_avertissements INTEGER NOT NULL DEFAULT 0,
  rapport_erreurs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rapport_avertissements JSONB NOT NULL DEFAULT '[]'::jsonb,
  statut public.statut_import NOT NULL DEFAULT 'en_cours',
  demarre_a TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  termine_a TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_imports_organisation ON public.imports_excel(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_imports_statut ON public.imports_excel(statut) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.imports_excel IS 'Traçabilité des dépôts Excel — un enregistrement par fichier déposé';

-- 2.7. Journal d'audit ---------------------------------------------------------
CREATE TYPE public.action_audit AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE');

CREATE TABLE public.journaux_audit (
  id BIGSERIAL PRIMARY KEY,
  table_affectee TEXT NOT NULL,
  ligne_id UUID,
  action public.action_audit NOT NULL,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  horodatage TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_table_ligne ON public.journaux_audit(table_affectee, ligne_id);
CREATE INDEX idx_audit_user ON public.journaux_audit(user_id);
CREATE INDEX idx_audit_horodatage ON public.journaux_audit(horodatage DESC);

COMMENT ON TABLE public.journaux_audit IS 'Trace immuable des opérations INSERT/UPDATE/DELETE sur les tables métier';

-- Fonction d'audit générique (attachée via triggers ci-dessous)
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_diff JSONB;
  v_action public.action_audit;
  v_ligne_id UUID;
BEGIN
  v_user_id := auth.uid();
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_ligne_id := NEW.id;
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      v_action := 'SOFT_DELETE';
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_ligne_id := NEW.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_ligne_id := OLD.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.journaux_audit(table_affectee, ligne_id, action, diff, user_id, user_email)
  VALUES (TG_TABLE_NAME, v_ligne_id, v_action, v_diff, v_user_id, v_email);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =============================================================================
-- 3. TRIGGERS (updated_at + audit)
-- =============================================================================

-- updated_at sur toutes les tables métier
CREATE TRIGGER trg_organisations_upd BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_utilisateurs_upd BEFORE UPDATE ON public.utilisateurs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_beneficiaires_upd BEFORE UPDATE ON public.beneficiaires FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_structures_upd BEFORE UPDATE ON public.structures FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_reponses_upd BEFORE UPDATE ON public.reponses_enquetes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_imports_upd BEFORE UPDATE ON public.imports_excel FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit sur les tables métier sensibles
CREATE TRIGGER trg_beneficiaires_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.beneficiaires
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TRIGGER trg_structures_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.structures
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TRIGGER trg_reponses_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reponses_enquetes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE TRIGGER trg_utilisateurs_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.utilisateurs
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
