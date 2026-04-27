-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 018 : campagnes de collecte ciblées
-- -----------------------------------------------------------------------------
-- Refonte de la fonctionnalité « lancer une vague d'enquête » en gestion
-- complète de campagnes ciblées sur une STRATE (méthodologie OIF — on ne
-- lance jamais une enquête à tous les bénéficiaires d'un projet, on cible
-- une strate précise : ex. « bénéficiaires Mali 2024 formés au numérique »).
--
-- Apports :
--   • Table `campagnes_collecte` : persiste chaque campagne avec ses
--     paramètres (mode de sélection, filtres JSONB, cibles manuelles, plafond,
--     statut brouillon/programmée/envoyée/terminée).
--   • Lien `campagne_id` sur `tokens_enquete_publique` : retrouver depuis un
--     token quelle campagne l'a généré.
--   • Fonctions PostgreSQL :
--       - `compter_strate(p_questionnaire, p_filtres)` : compteurs en temps réel
--         (total, avec_email, sans_email, sans_consentement).
--       - `lister_strate(p_questionnaire, p_filtres, p_limit, p_offset)` :
--         pagination performante pour le mode manuel (5 618 lignes).
--
-- Sécurité : SECURITY DEFINER + garde rôle (admin_scs / editeur_projet /
-- contributeur_partenaire) reproduit en SQL — la RLS est respectée mais
-- contournée pour la performance des agrégats.
-- =============================================================================

-- 1. Type ENUM pour le statut de campagne (idempotent)
DO $$ BEGIN
  CREATE TYPE public.statut_campagne AS ENUM ('brouillon', 'programmee', 'envoyee', 'terminee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mode_selection_campagne AS ENUM ('toutes', 'filtres', 'manuelle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table principale
CREATE TABLE IF NOT EXISTS public.campagnes_collecte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL CHECK (length(nom) BETWEEN 3 AND 200),
  description TEXT,
  questionnaire CHAR(1) NOT NULL CHECK (questionnaire IN ('A', 'B')),
  type_vague TEXT NOT NULL,
  mode_selection public.mode_selection_campagne NOT NULL,
  -- Filtres JSONB structuré : { projets:[], pays:[], annees:[], sexe:'F'|null,
  -- statuts:[], structures:[], consentement_acquis_seul:true } pour Q A,
  -- { projets:[], pays:[], annees_appui:[], types_structure:[], secteurs:[] }
  -- pour Q B. Vide '{}' si mode_selection = 'toutes'.
  filtres JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- IDs des cibles cochées si mode_selection = 'manuelle'. NULL sinon.
  cibles_manuelles UUID[],
  plafond INTEGER NOT NULL DEFAULT 50 CHECK (plafond BETWEEN 1 AND 200),
  email_test_override TEXT,
  date_envoi_prevue TIMESTAMPTZ,
  statut public.statut_campagne NOT NULL DEFAULT 'brouillon',
  total_cibles INTEGER,
  total_envoyes INTEGER NOT NULL DEFAULT 0,
  total_repondus INTEGER NOT NULL DEFAULT 0,
  envoyee_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campagnes_statut
  ON public.campagnes_collecte(statut)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campagnes_questionnaire
  ON public.campagnes_collecte(questionnaire)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campagnes_created_by
  ON public.campagnes_collecte(created_by, created_at DESC);

CREATE TRIGGER trg_campagnes_upd
  BEFORE UPDATE ON public.campagnes_collecte
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_campagnes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.campagnes_collecte
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

COMMENT ON TABLE public.campagnes_collecte IS
  'Campagnes de collecte d''enquêtes ciblées sur une strate (méthodologie OIF). Une campagne peut être en brouillon, programmée, envoyée ou terminée.';

-- 3. Lien tokens_enquete_publique → campagne
ALTER TABLE public.tokens_enquete_publique
  ADD COLUMN IF NOT EXISTS campagne_id UUID REFERENCES public.campagnes_collecte(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_campagne
  ON public.tokens_enquete_publique(campagne_id)
  WHERE campagne_id IS NOT NULL;

-- 4. RLS — admin SCS total accès, créateur peut lire/modifier ses brouillons
ALTER TABLE public.campagnes_collecte ENABLE ROW LEVEL SECURITY;

CREATE POLICY campagnes_select ON public.campagnes_collecte
  FOR SELECT TO authenticated
  USING (
    public.is_admin_scs()
    OR created_by = auth.uid()
  );

CREATE POLICY campagnes_admin ON public.campagnes_collecte
  FOR ALL TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- Le créateur peut INSERT (création de brouillon) et UPDATE ses propres
-- campagnes tant qu'elles sont en brouillon.
CREATE POLICY campagnes_creator_insert ON public.campagnes_collecte
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_metier() IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire')
    AND created_by = auth.uid()
  );

CREATE POLICY campagnes_creator_update ON public.campagnes_collecte
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND statut = 'brouillon')
  WITH CHECK (created_by = auth.uid() AND statut IN ('brouillon', 'programmee'));

GRANT ALL ON public.campagnes_collecte TO authenticated, service_role;

-- =============================================================================
-- 5. Fonction compter_strate — compteurs temps réel pour l'UI wizard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compter_strate(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_uid UUID;
  v_org UUID;
  v_projets TEXT[];
  v_total INTEGER;
  v_avec_email INTEGER;
  v_sans_email INTEGER;
  v_sans_consentement INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN jsonb_build_object('erreur', 'reserve');
  END IF;

  v_projets := public.current_projets_geres();

  IF p_questionnaire = 'A' THEN
    -- Bénéficiaires
    WITH base AS (
      SELECT b.id, b.courriel, b.consentement_recueilli
      FROM public.beneficiaires b
      WHERE b.deleted_at IS NULL
        -- RLS reproduite : périmètre du rôle
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (b.created_by = v_uid OR b.organisation_id = v_org))
        )
        -- Filtres user
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR b.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR b.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees'
          OR jsonb_array_length(p_filtres->'annees') = 0
          OR b.annee_formation = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'sexe'
          OR p_filtres->>'sexe' IS NULL
          OR p_filtres->>'sexe' = ''
          OR b.sexe::text = p_filtres->>'sexe'
        )
        AND (
          NOT p_filtres ? 'statuts'
          OR jsonb_array_length(p_filtres->'statuts') = 0
          OR b.statut_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'statuts'))
        )
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE courriel IS NOT NULL AND courriel <> '' AND consentement_recueilli),
      COUNT(*) FILTER (WHERE courriel IS NULL OR courriel = '' OR NOT consentement_recueilli),
      COUNT(*) FILTER (WHERE NOT consentement_recueilli)
    INTO v_total, v_avec_email, v_sans_email, v_sans_consentement
    FROM base;
  ELSE
    -- Structures
    WITH base AS (
      SELECT s.id, s.courriel_porteur AS courriel, s.consentement_recueilli
      FROM public.structures s
      WHERE s.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (s.created_by = v_uid OR s.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR s.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR s.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees_appui'
          OR jsonb_array_length(p_filtres->'annees_appui') = 0
          OR s.annee_appui = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees_appui'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'types_structure'
          OR jsonb_array_length(p_filtres->'types_structure') = 0
          OR s.type_structure_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'types_structure'))
        )
        AND (
          NOT p_filtres ? 'secteurs'
          OR jsonb_array_length(p_filtres->'secteurs') = 0
          OR s.secteur_activite_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'secteurs'))
        )
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE courriel IS NOT NULL AND courriel <> '' AND consentement_recueilli),
      COUNT(*) FILTER (WHERE courriel IS NULL OR courriel = '' OR NOT consentement_recueilli),
      COUNT(*) FILTER (WHERE NOT consentement_recueilli)
    INTO v_total, v_avec_email, v_sans_email, v_sans_consentement
    FROM base;
  END IF;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'avec_email', COALESCE(v_avec_email, 0),
    'sans_email', COALESCE(v_sans_email, 0),
    'sans_consentement', COALESCE(v_sans_consentement, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compter_strate(CHAR, JSONB) TO authenticated;

-- =============================================================================
-- 6. Fonction lister_strate — pagination pour mode manuel
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lister_strate(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb,
  p_recherche TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  libelle TEXT,
  email TEXT,
  pays_code TEXT,
  projet_code TEXT,
  annee INTEGER,
  consentement BOOLEAN,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_uid UUID;
  v_org UUID;
  v_projets TEXT[];
  v_recherche TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN;
  END IF;

  v_projets := public.current_projets_geres();
  v_recherche := CASE
    WHEN p_recherche IS NULL OR length(trim(p_recherche)) = 0 THEN NULL
    ELSE '%' || lower(trim(p_recherche)) || '%'
  END;

  IF p_questionnaire = 'A' THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        b.id,
        (b.prenom || ' ' || b.nom) AS libelle,
        b.courriel AS email,
        b.pays_code,
        b.projet_code,
        b.annee_formation AS annee,
        b.consentement_recueilli AS consentement
      FROM public.beneficiaires b
      WHERE b.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND b.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (b.created_by = v_uid OR b.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR b.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR b.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees'
          OR jsonb_array_length(p_filtres->'annees') = 0
          OR b.annee_formation = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'sexe'
          OR p_filtres->>'sexe' IS NULL
          OR p_filtres->>'sexe' = ''
          OR b.sexe::text = p_filtres->>'sexe'
        )
        AND (
          NOT p_filtres ? 'statuts'
          OR jsonb_array_length(p_filtres->'statuts') = 0
          OR b.statut_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'statuts'))
        )
        AND (
          v_recherche IS NULL
          OR lower(b.prenom) LIKE v_recherche
          OR lower(b.nom) LIKE v_recherche
          OR lower(coalesce(b.courriel, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT * FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  ELSE
    RETURN QUERY
    WITH base AS (
      SELECT
        s.id,
        s.nom_structure AS libelle,
        s.courriel_porteur AS email,
        s.pays_code,
        s.projet_code,
        s.annee_appui AS annee,
        s.consentement_recueilli AS consentement
      FROM public.structures s
      WHERE s.deleted_at IS NULL
        AND (
          v_role = 'admin_scs'
          OR (v_role = 'editeur_projet' AND s.projet_code = ANY(v_projets))
          OR (v_role = 'contributeur_partenaire'
              AND (s.created_by = v_uid OR s.organisation_id = v_org))
        )
        AND (
          NOT p_filtres ? 'projets'
          OR jsonb_array_length(p_filtres->'projets') = 0
          OR s.projet_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'projets'))
        )
        AND (
          NOT p_filtres ? 'pays'
          OR jsonb_array_length(p_filtres->'pays') = 0
          OR s.pays_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'pays'))
        )
        AND (
          NOT p_filtres ? 'annees_appui'
          OR jsonb_array_length(p_filtres->'annees_appui') = 0
          OR s.annee_appui = ANY(SELECT (jsonb_array_elements_text(p_filtres->'annees_appui'))::INTEGER)
        )
        AND (
          NOT p_filtres ? 'types_structure'
          OR jsonb_array_length(p_filtres->'types_structure') = 0
          OR s.type_structure_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'types_structure'))
        )
        AND (
          NOT p_filtres ? 'secteurs'
          OR jsonb_array_length(p_filtres->'secteurs') = 0
          OR s.secteur_activite_code = ANY(SELECT jsonb_array_elements_text(p_filtres->'secteurs'))
        )
        AND (
          v_recherche IS NULL
          OR lower(s.nom_structure) LIKE v_recherche
          OR lower(coalesce(s.courriel_porteur, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT * FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_strate(CHAR, JSONB, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.compter_strate IS
  'Compteurs strate pour le wizard de campagne : total / avec_email / sans_email / sans_consentement. Filtré par rôle + filtres JSONB.';

COMMENT ON FUNCTION public.lister_strate IS
  'Pagination strate pour mode manuel du wizard de campagne (50 par page par défaut). Recherche texte sur nom/email + filtres JSONB.';
