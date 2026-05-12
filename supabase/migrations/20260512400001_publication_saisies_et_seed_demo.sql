-- =============================================================================
-- Migration — Publication des saisies d'indicateurs + seed démo temporaire
-- -----------------------------------------------------------------------------
-- 1) Ajoute une colonne `publie` (BOOLEAN) à `valeurs_indicateurs_saisies`
--    afin de gérer l'état brouillon → publié, à la manière des analyses IA.
--    Seules les saisies publiées sont visibles par les rôles non-admin (et
--    par les pages publiques) ; les admin_scs / super_admin voient tout.
--
-- 2) Ajoute la RPC `basculer_publi_saisie_valeur` (admin_scs / super_admin).
--
-- 3) Corrige `lister_indicateurs_avec_valeurs_annuelles` :
--    a. Adapte le filtre des saisies selon le rôle (`publie = TRUE` exigé
--       pour les rôles non-admin).
--    b. Pour A2 (taux d'achèvement), priorité au calcul automatique BDD :
--       si la BDD fournit num/denom, on les utilise ; les saisies ne
--       comblent que ce qui manque (auto-update si la BDD se remplit).
--
-- 4) Insère des saisies « démo » pour les 14 indicateurs encore non
--    alimentés par la BDD (A2..F1 sauf A1, B1, B4 qui sont calculés).
--    Toutes en état `publie = FALSE` (brouillon) — le SCS publiera après
--    revue.  Note: 'demo_v2.5.2 — à remplacer dès collecte réelle'.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Colonne publie + index
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.valeurs_indicateurs_saisies
  ADD COLUMN IF NOT EXISTS publie BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_valeurs_indicateurs_saisies_publie
  ON public.valeurs_indicateurs_saisies(indicateur_code, publie);

COMMENT ON COLUMN public.valeurs_indicateurs_saisies.publie IS
  'TRUE = visible par tous les rôles + pages publiques. FALSE = brouillon visible uniquement admin_scs / super_admin.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC : basculer publication d'une saisie
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.basculer_publi_saisie_valeur(
  p_code   TEXT,
  p_annee  INTEGER,
  p_publie BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_affected INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;
  IF NOT (public.is_admin_scs() OR public.current_role_metier() = 'super_admin') THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin_scs');
  END IF;

  UPDATE public.valeurs_indicateurs_saisies
  SET publie = p_publie,
      published_at = CASE WHEN p_publie THEN NOW() ELSE NULL END,
      published_by = CASE WHEN p_publie THEN v_uid ELSE NULL END,
      updated_at = NOW(),
      updated_by = v_uid
  WHERE indicateur_code = p_code AND annee = p_annee;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RETURN jsonb_build_object('erreur', 'saisie_introuvable', 'code', p_code, 'annee', p_annee);
  END IF;

  RETURN jsonb_build_object(
    'succes', TRUE,
    'code', p_code,
    'annee', p_annee,
    'publie', p_publie
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.basculer_publi_saisie_valeur(TEXT, INTEGER, BOOLEAN)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. lister_indicateurs_avec_valeurs_annuelles — filtre par rôle + A2 fix
-- ─────────────────────────────────────────────────────────────────────────────
-- Logique A2 : auto prioritaire (BDD). Saisies en fallback uniquement
-- (sur ce qui n'est pas fourni par la BDD).
--
-- Saisies visibles :
--   - super_admin / admin_scs : toutes (publie = TRUE OU FALSE)
--   - autres rôles            : publie = TRUE uniquement
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lister_indicateurs_avec_valeurs_annuelles()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role public.role_utilisateur;
  v_voit_brouillons BOOLEAN;
  v_projets TEXT[];
  v_resultat JSONB := '[]'::JSONB;
  v_annee_min INTEGER := 2020;
  v_annee_max INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;

  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;
  IF v_role IS NULL THEN RETURN jsonb_build_object('erreur', 'pas_de_profil'); END IF;

  v_voit_brouillons := (v_role IN ('super_admin', 'admin_scs'));
  v_projets := public.current_projets_geres();

  -- ──── A1 — Effectifs bénéficiaires (auto inchangé) ───────────────────
  WITH valeurs AS (
    SELECT
      b.annee_formation AS annee,
      COUNT(*)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE b.sexe = 'F')::INTEGER AS femmes,
      COUNT(*) FILTER (WHERE b.sexe = 'M')::INTEGER AS hommes
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
    GROUP BY b.annee_formation
    ORDER BY b.annee_formation
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'femmes', femmes, 'hommes', hommes, 'source', 'auto'
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── A2 — Taux d'achèvement (BDD prioritaire, saisies en fallback) ──
  WITH auto AS (
    SELECT
      b.annee_formation AS annee,
      COUNT(*)::INTEGER AS denominateur_auto,
      COUNT(*) FILTER (WHERE b.statut_code = 'FORMATION_ACHEVEE')::INTEGER AS numerateur_auto
    FROM public.beneficiaires b
    WHERE b.deleted_at IS NULL
      AND b.annee_formation BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR b.projet_code = ANY(v_projets))
    GROUP BY b.annee_formation
  ),
  saisies AS (
    SELECT annee, numerateur AS num_saisi, denominateur AS denom_saisi
    FROM public.valeurs_indicateurs_saisies
    WHERE indicateur_code = 'A2'
      AND (v_voit_brouillons OR publie = TRUE)
  ),
  fusion AS (
    SELECT
      COALESCE(a.annee, s.annee) AS annee,
      -- auto prioritaire ; saisie ne sert que si auto absent
      COALESCE(a.numerateur_auto, s.num_saisi) AS numerateur,
      COALESCE(a.denominateur_auto, s.denom_saisi) AS denominateur,
      CASE
        WHEN a.numerateur_auto IS NOT NULL AND a.denominateur_auto IS NOT NULL THEN 'auto'
        WHEN (a.numerateur_auto IS NULL AND s.num_saisi IS NOT NULL)
          OR (a.denominateur_auto IS NULL AND s.denom_saisi IS NOT NULL)
          AND (a.numerateur_auto IS NOT NULL OR a.denominateur_auto IS NOT NULL) THEN 'mixte'
        ELSE 'saisie'
      END AS source
    FROM auto a FULL OUTER JOIN saisies s ON a.annee = s.annee
  ),
  valeurs AS (
    SELECT * FROM fusion
    WHERE annee BETWEEN v_annee_min AND v_annee_max
      AND denominateur IS NOT NULL AND denominateur >= 5
    ORDER BY annee
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'A2',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1),
      'numerateur', numerateur,
      'denominateur', denominateur,
      'source', source
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT ROUND(100.0 * numerateur / NULLIF(denominateur, 0), 1) FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B1 — Structures économiques appuyées (auto inchangé) ───────────
  WITH valeurs AS (
    SELECT
      s.annee_appui AS annee,
      COUNT(*)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.statut_creation = 'creation')::INTEGER AS creation,
      COUNT(*) FILTER (WHERE s.statut_creation = 'renforcement')::INTEGER AS renforcement
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
    GROUP BY s.annee_appui
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B1',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'creation', creation, 'renforcement', renforcement, 'source', 'auto'
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── B4 — Volume d'appui (auto inchangé) ────────────────────────────
  WITH valeurs AS (
    SELECT
      s.annee_appui AS annee,
      ROUND(SUM(COALESCE(s.montant_appui, 0))::NUMERIC, 0)::INTEGER AS valeur,
      COUNT(*) FILTER (WHERE s.montant_appui IS NOT NULL)::INTEGER AS nb_avec_montant
    FROM public.structures s
    WHERE s.deleted_at IS NULL
      AND s.annee_appui BETWEEN v_annee_min AND v_annee_max
      AND (v_role IN ('super_admin', 'admin_scs')
           OR v_projets IS NULL
           OR s.projet_code = ANY(v_projets))
    GROUP BY s.annee_appui
    HAVING SUM(COALESCE(s.montant_appui, 0)) > 0
    ORDER BY s.annee_appui
  )
  SELECT v_resultat || jsonb_build_object(
    'code', 'B4',
    'statut_calcul', CASE WHEN EXISTS(SELECT 1 FROM valeurs) THEN 'calcule' ELSE 'pas_de_donnees' END,
    'valeurs_par_annee', COALESCE(jsonb_agg(jsonb_build_object(
      'annee', annee, 'valeur', valeur, 'nb_avec_montant', nb_avec_montant, 'source', 'auto'
    )), '[]'::JSONB),
    'nb_annees_avec_donnees', (SELECT COUNT(DISTINCT annee) FROM valeurs)::INTEGER,
    'derniere_valeur', (SELECT valeur FROM valeurs ORDER BY annee DESC LIMIT 1),
    'derniere_annee',  (SELECT annee FROM valeurs ORDER BY annee DESC LIMIT 1)
  ) INTO v_resultat FROM valeurs;

  -- ──── Indicateurs non auto-mesurables (passés au helper) ──────────────
  v_resultat := v_resultat || jsonb_build_array(
    lister_indicateur_non_auto('A3', 'Nécessite données certification/attestation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A4', 'Nécessite scores avant/après formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('A5', 'Nécessite suivi 6/12 mois post-formation (enquête A V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B2', 'Nécessite suivi structures 12/24 mois (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('B3', 'Nécessite déclaration emplois créés (enquête B V2).', v_voit_brouillons),
    lister_indicateur_non_auto('C1', 'Pas encore de collecte sur les demandes d''accompagnement.', v_voit_brouillons),
    lister_indicateur_non_auto('C2', 'Pas encore de collecte sur les mises en relation.', v_voit_brouillons),
    lister_indicateur_non_auto('C3', 'Pas encore de collecte sur les partenariats économiques.', v_voit_brouillons),
    lister_indicateur_non_auto('C4', 'Pas encore de collecte.', v_voit_brouillons),
    lister_indicateur_non_auto('C5', 'Pas encore de collecte.', v_voit_brouillons),
    lister_indicateur_non_auto('D1', 'Nécessite suivi politiques publiques (collecte qualitative).', v_voit_brouillons),
    lister_indicateur_non_auto('D2', 'Nécessite suivi réformes adoptées.', v_voit_brouillons),
    lister_indicateur_non_auto('D3', 'Nécessite suivi adoption recommandations.', v_voit_brouillons),
    lister_indicateur_non_auto('F1', 'Nécessite question dédiée sur l''apport du français (enquête F).', v_voit_brouillons)
  );

  RETURN jsonb_build_object(
    'role', v_role,
    'annee_min', v_annee_min,
    'annee_max', v_annee_max,
    'indicateurs', v_resultat
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper actualisé — accepte le filtre brouillon/publié
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lister_indicateur_non_auto(
  p_code TEXT,
  p_mention_si_vide TEXT,
  p_voit_brouillons BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valeurs JSONB;
  v_nb INTEGER;
  v_derniere_valeur NUMERIC;
  v_derniere_annee INTEGER;
BEGIN
  WITH src AS (
    SELECT annee, numerateur, denominateur, valeur_directe, publie
    FROM public.valeurs_indicateurs_saisies
    WHERE indicateur_code = p_code
      AND (p_voit_brouillons OR publie = TRUE)
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'annee', annee,
      'valeur', COALESCE(
        valeur_directe,
        CASE WHEN denominateur IS NOT NULL AND denominateur > 0
          THEN ROUND(100.0 * numerateur / denominateur, 1)
          ELSE numerateur
        END
      ),
      'numerateur', numerateur,
      'denominateur', denominateur,
      'publie', publie,
      'source', 'saisie'
    ) ORDER BY annee),
    COUNT(*)
  INTO v_valeurs, v_nb
  FROM src;

  SELECT COALESCE(
    valeur_directe,
    CASE WHEN denominateur IS NOT NULL AND denominateur > 0
      THEN ROUND(100.0 * numerateur / denominateur, 1)
      ELSE numerateur
    END
  ), annee
  INTO v_derniere_valeur, v_derniere_annee
  FROM public.valeurs_indicateurs_saisies
  WHERE indicateur_code = p_code
    AND (p_voit_brouillons OR publie = TRUE)
  ORDER BY annee DESC LIMIT 1;

  IF v_nb > 0 THEN
    RETURN jsonb_build_object(
      'code', p_code,
      'statut_calcul', 'saisie_manuelle',
      'valeurs_par_annee', v_valeurs,
      'nb_annees_avec_donnees', v_nb,
      'derniere_valeur', v_derniere_valeur,
      'derniere_annee', v_derniere_annee
    );
  END IF;

  RETURN jsonb_build_object(
    'code', p_code,
    'statut_calcul', 'non_mesurable',
    'mention', p_mention_si_vide,
    'valeurs_par_annee', '[]'::JSONB,
    'nb_annees_avec_donnees', 0,
    'derniere_valeur', null,
    'derniere_annee', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lister_indicateur_non_auto(TEXT, TEXT, BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed démo — 14 indicateurs × jusqu'à 4 années
-- ─────────────────────────────────────────────────────────────────────────────
-- Valeurs plausibles calibrées sur la volumétrie BDD (~5500 bénéficiaires
-- sur 2023-2026). Toutes en brouillon (`publie = FALSE`).  Le SCS pourra
-- publier après revue. Si la BDD se remplit (enquêtes A V2, etc.), la
-- valeur auto prendra le pas (logique de COALESCE auto > saisie).
-- =============================================================================

INSERT INTO public.valeurs_indicateurs_saisies
  (indicateur_code, annee, numerateur, denominateur, valeur_directe, note, publie)
VALUES
  -- A2 — Taux d'achèvement (en complément BDD si manquante)
  ('A2', 2023, 870, 1000, NULL, 'demo v2.5.2 — calibré sur volumétrie BDD', FALSE),
  ('A2', 2024, 1010, 1200, NULL, 'demo v2.5.2 — calibré sur volumétrie BDD', FALSE),
  ('A2', 2025, 1390, 1600, NULL, 'demo v2.5.2 — calibré sur volumétrie BDD', FALSE),
  ('A2', 2026, 1480, 1700, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- A3 — Taux de certification
  ('A3', 2023, 760, 1000, NULL, 'demo v2.5.2 — à remplacer dès enquête A', FALSE),
  ('A3', 2024, 900, 1200, NULL, 'demo v2.5.2 — à remplacer dès enquête A', FALSE),
  ('A3', 2025, 1280, 1600, NULL, 'demo v2.5.2 — à remplacer dès enquête A', FALSE),
  ('A3', 2026, 1330, 1700, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- A4 — Gain compétences
  ('A4', 2023, 880, 1000, NULL, 'demo v2.5.2 — questionnaire avant/après', FALSE),
  ('A4', 2024, 1060, 1200, NULL, 'demo v2.5.2 — questionnaire avant/après', FALSE),
  ('A4', 2025, 1440, 1600, NULL, 'demo v2.5.2 — questionnaire avant/après', FALSE),
  ('A4', 2026, 1520, 1700, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- A5 — Insertion 6/12 mois (pas 2026, trop tôt)
  ('A5', 2023, 620, 1000, NULL, 'demo v2.5.2 — enquête insertion à 12 mois', FALSE),
  ('A5', 2024, 780, 1200, NULL, 'demo v2.5.2 — enquête insertion à 12 mois', FALSE),
  ('A5', 2025, 1100, 1600, NULL, 'demo v2.5.2 — enquête insertion à 6 mois', FALSE),

  -- B2 — Survie 12/24 mois (pas 2026)
  ('B2', 2023, 85, 100, NULL, 'demo v2.5.2 — suivi structures appuyées', FALSE),
  ('B2', 2024, 105, 130, NULL, 'demo v2.5.2 — suivi structures appuyées', FALSE),
  ('B2', 2025, 155, 180, NULL, 'demo v2.5.2 — suivi structures appuyées', FALSE),

  -- B3 — Emplois créés/maintenus (effectif direct)
  ('B3', 2023, NULL, NULL, 350, 'demo v2.5.2 — déclaration bénéficiaires', FALSE),
  ('B3', 2024, NULL, NULL, 420, 'demo v2.5.2 — déclaration bénéficiaires', FALSE),
  ('B3', 2025, NULL, NULL, 580, 'demo v2.5.2 — déclaration bénéficiaires', FALSE),
  ('B3', 2026, NULL, NULL, 240, 'demo v2.5.2 — partiel', FALSE),

  -- C1 — Mises en relation (effectif)
  ('C1', 2023, NULL, NULL, 180, 'demo v2.5.2 — événements B2B + plateformes', FALSE),
  ('C1', 2024, NULL, NULL, 250, 'demo v2.5.2 — événements B2B + plateformes', FALSE),
  ('C1', 2025, NULL, NULL, 420, 'demo v2.5.2 — événements B2B + plateformes', FALSE),
  ('C1', 2026, NULL, NULL, 320, 'demo v2.5.2 — partiel', FALSE),

  -- C2 — Taux conversion
  ('C2', 2023, 45, 180, NULL, 'demo v2.5.2 — sur la base de C1', FALSE),
  ('C2', 2024, 75, 250, NULL, 'demo v2.5.2 — sur la base de C1', FALSE),
  ('C2', 2025, 145, 420, NULL, 'demo v2.5.2 — sur la base de C1', FALSE),
  ('C2', 2026, 105, 320, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- C3 — Emplois obtenus (effectif)
  ('C3', 2023, NULL, NULL, 60, 'demo v2.5.2 — preuves légères + déclaratif', FALSE),
  ('C3', 2024, NULL, NULL, 90, 'demo v2.5.2 — preuves légères + déclaratif', FALSE),
  ('C3', 2025, NULL, NULL, 170, 'demo v2.5.2 — preuves légères + déclaratif', FALSE),
  ('C3', 2026, NULL, NULL, 130, 'demo v2.5.2 — partiel', FALSE),

  -- C4 — Délai accès opportunité (jours, valeur directe)
  ('C4', 2023, NULL, NULL, 85, 'demo v2.5.2 — moyenne jours', FALSE),
  ('C4', 2024, NULL, NULL, 78, 'demo v2.5.2 — moyenne jours', FALSE),
  ('C4', 2025, NULL, NULL, 65, 'demo v2.5.2 — moyenne jours', FALSE),
  ('C4', 2026, NULL, NULL, 70, 'demo v2.5.2 — moyenne jours', FALSE),

  -- C5 — Satisfaction
  ('C5', 2023, 145, 180, NULL, 'demo v2.5.2 — % jugé déterminant', FALSE),
  ('C5', 2024, 210, 250, NULL, 'demo v2.5.2 — % jugé déterminant', FALSE),
  ('C5', 2025, 360, 420, NULL, 'demo v2.5.2 — % jugé déterminant', FALSE),
  ('C5', 2026, 280, 320, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- D1 — Cadres/dispositifs appuyés (effectif)
  ('D1', 2023, NULL, NULL, 3, 'demo v2.5.2 — revue documentaire', FALSE),
  ('D1', 2024, NULL, NULL, 5, 'demo v2.5.2 — revue documentaire', FALSE),
  ('D1', 2025, NULL, NULL, 8, 'demo v2.5.2 — revue documentaire', FALSE),
  ('D1', 2026, NULL, NULL, 6, 'demo v2.5.2 — partiel', FALSE),

  -- D2 — Capacités renforcées
  ('D2', 2023, 30, 50, NULL, 'demo v2.5.2 — enquête acteurs publics', FALSE),
  ('D2', 2024, 45, 65, NULL, 'demo v2.5.2 — enquête acteurs publics', FALSE),
  ('D2', 2025, 70, 90, NULL, 'demo v2.5.2 — enquête acteurs publics', FALSE),
  ('D2', 2026, 55, 75, NULL, 'demo v2.5.2 — partiel', FALSE),

  -- D3 — Effets observables (effectif d'études de cas / changements)
  ('D3', 2023, NULL, NULL, 5, 'demo v2.5.2 — études de cas qualitatives', FALSE),
  ('D3', 2024, NULL, NULL, 8, 'demo v2.5.2 — études de cas qualitatives', FALSE),
  ('D3', 2025, NULL, NULL, 14, 'demo v2.5.2 — études de cas qualitatives', FALSE),
  ('D3', 2026, NULL, NULL, 10, 'demo v2.5.2 — partiel', FALSE),

  -- F1 — Apport français (marqueur transversal)
  ('F1', 2023, 750, 1000, NULL, 'demo v2.5.2 — auto-déclaration bénéficiaires', FALSE),
  ('F1', 2024, 960, 1200, NULL, 'demo v2.5.2 — auto-déclaration bénéficiaires', FALSE),
  ('F1', 2025, 1280, 1600, NULL, 'demo v2.5.2 — auto-déclaration bénéficiaires', FALSE),
  ('F1', 2026, 1410, 1700, NULL, 'demo v2.5.2 — partiel', FALSE)
ON CONFLICT (indicateur_code, annee) DO NOTHING;
