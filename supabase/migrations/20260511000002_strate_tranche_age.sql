-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 026 : filtre tranche_age dans strate
-- -----------------------------------------------------------------------------
-- Harmonise tranche_age_declaree dans le workflow campagnes / enquêtes.
--
-- Modifications :
--   1. lister_strate      → ajoute colonne tranche_age_declaree + filtre tranche_age
--   2. compter_strate     → ajoute filtre tranche_age (questionnaire A uniquement)
--   3. lister_strate_ids  → ajoute filtre tranche_age (questionnaire A uniquement)
--
-- Logique du filtre :
--   Si p_filtres contient la clé 'tranche_age' avec une valeur non nulle
--   ('Jeune' ou 'Adulte'), on filtre sur b.tranche_age_declaree.
--   Absence de la clé ou valeur vide = pas de filtre (comportement inchangé).
--
-- Compatibilité ascendante :
--   Tous les appels existants sans 'tranche_age' dans p_filtres fonctionnent
--   exactement comme avant. Aucun changement de signature.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lister_strate — ajout colonne tranche_age_declaree + filtre
-- ─────────────────────────────────────────────────────────────────────────────
-- Le retour TABLE change (ajout colonne tranche_age_declaree), donc Postgres
-- refuse un simple CREATE OR REPLACE — il faut un DROP préalable.
-- IF EXISTS pour idempotence (replay de la migration).
DROP FUNCTION IF EXISTS public.lister_strate(CHAR, JSONB, TEXT, INTEGER, INTEGER);

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
  tranche_age_declaree TEXT,
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
        b.consentement_recueilli AS consentement,
        b.tranche_age_declaree
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
        -- Nouveau filtre : tranche d'âge déclarée (Jeune / Adulte)
        AND (
          NOT p_filtres ? 'tranche_age'
          OR p_filtres->>'tranche_age' IS NULL
          OR p_filtres->>'tranche_age' = ''
          OR b.tranche_age_declaree = p_filtres->>'tranche_age'
        )
        AND (
          v_recherche IS NULL
          OR lower(b.prenom) LIKE v_recherche
          OR lower(b.nom) LIKE v_recherche
          OR lower(coalesce(b.courriel, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT
      counted.id,
      counted.libelle,
      counted.email,
      counted.pays_code,
      counted.projet_code,
      counted.annee,
      counted.consentement,
      counted.tranche_age_declaree,
      counted.total_count
    FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- Questionnaire B (structures) — pas de tranche_age, retourne NULL
    RETURN QUERY
    WITH base AS (
      SELECT
        s.id,
        s.nom_structure AS libelle,
        s.courriel_porteur AS email,
        s.pays_code,
        s.projet_code,
        s.annee_appui AS annee,
        s.consentement_recueilli AS consentement,
        NULL::TEXT AS tranche_age_declaree
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
          v_recherche IS NULL
          OR lower(s.nom_structure) LIKE v_recherche
          OR lower(coalesce(s.courriel_porteur, '')) LIKE v_recherche
        )
    ),
    counted AS (SELECT *, COUNT(*) OVER () AS total_count FROM base)
    SELECT
      counted.id,
      counted.libelle,
      counted.email,
      counted.pays_code,
      counted.projet_code,
      counted.annee,
      counted.consentement,
      counted.tranche_age_declaree,
      counted.total_count
    FROM counted
    ORDER BY libelle
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. compter_strate — ajout filtre tranche_age (questionnaire A)
-- ─────────────────────────────────────────────────────────────────────────────
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
    WITH base AS (
      SELECT b.id, b.courriel, b.consentement_recueilli
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
          NOT p_filtres ? 'tranche_age'
          OR p_filtres->>'tranche_age' IS NULL
          OR p_filtres->>'tranche_age' = ''
          OR b.tranche_age_declaree = p_filtres->>'tranche_age'
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
    'total', v_total,
    'avec_email', v_avec_email,
    'sans_email', v_sans_email,
    'sans_consentement', v_sans_consentement
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. lister_strate_ids — ajout filtre tranche_age (questionnaire A)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lister_strate_ids(
  p_questionnaire CHAR(1),
  p_filtres JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID[]
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
  v_ids UUID[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN ARRAY[]::UUID[]; END IF;

  SELECT role, organisation_id INTO v_role, v_org
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role NOT IN ('admin_scs', 'editeur_projet', 'contributeur_partenaire') THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  v_projets := public.current_projets_geres();

  IF p_questionnaire = 'A' THEN
    SELECT COALESCE(array_agg(b.id), ARRAY[]::UUID[]) INTO v_ids
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
        NOT p_filtres ? 'tranche_age'
        OR p_filtres->>'tranche_age' IS NULL
        OR p_filtres->>'tranche_age' = ''
        OR b.tranche_age_declaree = p_filtres->>'tranche_age'
      );
  ELSE
    SELECT COALESCE(array_agg(s.id), ARRAY[]::UUID[]) INTO v_ids
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
      );
  END IF;

  RETURN v_ids;
END;
$$;


-- Commentaires explicatifs
COMMENT ON FUNCTION public.lister_strate IS
  'Retourne les cibles paginées (bénéficiaires ou structures) selon les filtres JSONB. Supporte tranche_age (Jeune/Adulte) pour questionnaire A depuis migration 026.';

COMMENT ON FUNCTION public.compter_strate IS
  'Compte les cibles éligibles avec totaux email/consentement. Supporte tranche_age pour questionnaire A depuis migration 026.';

COMMENT ON FUNCTION public.lister_strate_ids IS
  'Retourne les UUID des cibles éligibles (sans détail). Supporte tranche_age pour questionnaire A depuis migration 026.';
