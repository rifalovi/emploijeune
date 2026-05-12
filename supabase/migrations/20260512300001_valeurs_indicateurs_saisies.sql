-- =============================================================================
-- Migration — Saisie manuelle des valeurs d'indicateurs (compléments BDD)
-- -----------------------------------------------------------------------------
-- Permet à l'admin SCS / super_admin de saisir manuellement le numérateur,
-- dénominateur ou la valeur d'un indicateur pour une année donnée, quand la
-- BDD ne dispose pas des données nécessaires au calcul automatique.
--
-- Règle de priorité dans la RPC d'agrégation :
--   1. Si la BDD fournit les données : calcul automatique prioritaire.
--   2. Si la BDD fournit le numérateur seulement (cas A2 sans dénominateur
--      fiable), on complète avec le dénominateur saisi.
--   3. Si la BDD ne fournit rien : on utilise les valeurs saisies.
--
-- Cas d'usage : pour A2 (taux d'achèvement), on connaît parfois le nombre
-- d'achèvements via une enquête séparée sans avoir le nombre total
-- d'inscrits. Le SCS peut saisir "200 inscrits cette année-là" pour
-- obtenir le taux.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.valeurs_indicateurs_saisies (
  indicateur_code   TEXT NOT NULL,
  annee             INTEGER NOT NULL,
  /** Numérateur saisi manuellement (NULL si la BDD le fournit ou non applicable). */
  numerateur        INTEGER,
  /** Dénominateur saisi manuellement. */
  denominateur      INTEGER,
  /** Valeur directe saisie (pour les indicateurs qui ne sont pas des taux). */
  valeur_directe    NUMERIC,
  /** Note explicative de l'origine de la saisie (rapport SCS, enquête, etc.). */
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (indicateur_code, annee)
);

CREATE INDEX IF NOT EXISTS idx_valeurs_indicateurs_saisies_code
  ON public.valeurs_indicateurs_saisies(indicateur_code);

COMMENT ON TABLE public.valeurs_indicateurs_saisies IS
  'Saisie manuelle des numérateurs/dénominateurs/valeurs pour les indicateurs CMR — complément aux calculs automatiques de la RPC lister_indicateurs_avec_valeurs_annuelles. Réservé à admin_scs et super_admin.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : lecture authentifiée, écriture admin_scs / super_admin
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.valeurs_indicateurs_saisies ENABLE ROW LEVEL SECURITY;

CREATE POLICY valeurs_saisies_read ON public.valeurs_indicateurs_saisies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY valeurs_saisies_insert ON public.valeurs_indicateurs_saisies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs() OR public.current_role_metier() = 'super_admin'
  );

CREATE POLICY valeurs_saisies_update ON public.valeurs_indicateurs_saisies
  FOR UPDATE TO authenticated
  USING (public.is_admin_scs() OR public.current_role_metier() = 'super_admin')
  WITH CHECK (public.is_admin_scs() OR public.current_role_metier() = 'super_admin');

CREATE POLICY valeurs_saisies_delete ON public.valeurs_indicateurs_saisies
  FOR DELETE TO authenticated
  USING (public.is_admin_scs() OR public.current_role_metier() = 'super_admin');

GRANT ALL ON public.valeurs_indicateurs_saisies TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : enregistrer_valeur_indicateur_saisie
-- ─────────────────────────────────────────────────────────────────────────────
-- Upsert d'une valeur manuelle. Au moins un des champs num/denom/valeur_directe
-- doit être renseigné. Réservé admin_scs / super_admin.

CREATE OR REPLACE FUNCTION public.enregistrer_valeur_indicateur_saisie(
  p_code        TEXT,
  p_annee       INTEGER,
  p_numerateur  INTEGER DEFAULT NULL,
  p_denominateur INTEGER DEFAULT NULL,
  p_valeur_directe NUMERIC DEFAULT NULL,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;

  IF NOT (public.is_admin_scs() OR public.current_role_metier() = 'super_admin') THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin_scs');
  END IF;

  -- Validation : au moins une valeur fournie
  IF p_numerateur IS NULL AND p_denominateur IS NULL AND p_valeur_directe IS NULL THEN
    RETURN jsonb_build_object('erreur', 'aucune_valeur_fournie');
  END IF;

  -- Validation : indicateur existant
  IF NOT EXISTS (SELECT 1 FROM public.indicateurs_config WHERE indicateur_code = p_code) THEN
    RETURN jsonb_build_object('erreur', 'indicateur_inconnu', 'code', p_code);
  END IF;

  -- Validation année
  IF p_annee < 2020 OR p_annee > EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1 THEN
    RETURN jsonb_build_object('erreur', 'annee_invalide', 'annee', p_annee);
  END IF;

  INSERT INTO public.valeurs_indicateurs_saisies
    (indicateur_code, annee, numerateur, denominateur, valeur_directe, note, created_by, updated_by)
  VALUES
    (p_code, p_annee, p_numerateur, p_denominateur, p_valeur_directe, p_note, v_uid, v_uid)
  ON CONFLICT (indicateur_code, annee) DO UPDATE
  SET numerateur = EXCLUDED.numerateur,
      denominateur = EXCLUDED.denominateur,
      valeur_directe = EXCLUDED.valeur_directe,
      note = EXCLUDED.note,
      updated_at = NOW(),
      updated_by = v_uid;

  RETURN jsonb_build_object(
    'succes', TRUE,
    'code', p_code,
    'annee', p_annee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enregistrer_valeur_indicateur_saisie(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : supprimer_valeur_indicateur_saisie
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.supprimer_valeur_indicateur_saisie(
  p_code  TEXT,
  p_annee INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN jsonb_build_object('erreur', 'non_authentifie'); END IF;
  IF NOT (public.is_admin_scs() OR public.current_role_metier() = 'super_admin') THEN
    RETURN jsonb_build_object('erreur', 'reserve_admin_scs');
  END IF;

  DELETE FROM public.valeurs_indicateurs_saisies
  WHERE indicateur_code = p_code AND annee = p_annee;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'annee', p_annee);
END;
$$;

GRANT EXECUTE ON FUNCTION public.supprimer_valeur_indicateur_saisie(TEXT, INTEGER) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC d'agrégation actualisée — intègre les valeurs saisies en fallback
-- ─────────────────────────────────────────────────────────────────────────────
-- Logique pour les indicateurs CALCULABLES depuis BDD (A1, A2, B1, B4) :
--   - Le calcul automatique est appliqué d'abord.
--   - Pour A2 (taux) : si la BDD n'a PAS de dénominateur (< 5 inscrits, donc
--     filtré par le HAVING), on regarde dans valeurs_indicateurs_saisies.
--     Si une saisie existe pour cette année, on prend num saisi (ou auto si
--     dispo) / denom saisi (ou auto).
--
-- Logique pour les indicateurs NON_MESURABLES (A3, A4, A5, B2, B3, C*, D*, F1) :
--   - On lit directement les valeurs saisies dans valeurs_indicateurs_saisies.
--   - Si des saisies existent, statut_calcul passe à 'saisie_manuelle'.
--
-- Champ `source` ajouté dans chaque valeur annuelle :
--   - 'auto'    : calculé depuis BDD
--   - 'saisie'  : 100% saisie manuelle (cas non_mesurable)
--   - 'mixte'   : numérateur auto, dénominateur saisi (ou inverse)
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

  v_projets := public.current_projets_geres();

  -- ──── A1 — Effectifs bénéficiaires (calcul auto inchangé) ─────────────
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

  -- ──── A2 — Taux d'achèvement (auto + fusion avec saisies) ────────────
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
  ),
  fusion AS (
    SELECT
      COALESCE(a.annee, s.annee) AS annee,
      COALESCE(s.num_saisi, a.numerateur_auto) AS numerateur,
      COALESCE(s.denom_saisi, a.denominateur_auto) AS denominateur,
      CASE
        WHEN s.num_saisi IS NOT NULL AND s.denom_saisi IS NOT NULL THEN 'saisie'
        WHEN s.num_saisi IS NOT NULL OR s.denom_saisi IS NOT NULL THEN 'mixte'
        ELSE 'auto'
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

  -- ──── B1 — Structures économiques appuyées (calcul auto inchangé) ────
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

  -- ──── B4 — Volume d'appui (calcul auto inchangé) ─────────────────────
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

  -- ──── Indicateurs non encore mesurables — mais saisies possibles ──────
  -- Pour chacun (A3, A4, A5, B2, B3, C1-C5, D1-D3, F1), on regarde s'il y a
  -- des saisies manuelles. Si oui, l'indicateur devient 'saisie_manuelle'
  -- avec les valeurs saisies. Sinon, il reste 'non_mesurable'.
  v_resultat := v_resultat || jsonb_build_array(
    lister_indicateur_non_auto('A3', 'Nécessite données certification/attestation (enquête A V2).'),
    lister_indicateur_non_auto('A4', 'Nécessite scores avant/après formation (enquête A V2).'),
    lister_indicateur_non_auto('A5', 'Nécessite suivi 6/12 mois post-formation (enquête A V2).'),
    lister_indicateur_non_auto('B2', 'Nécessite suivi structures 12/24 mois (enquête B V2).'),
    lister_indicateur_non_auto('B3', 'Nécessite déclaration emplois créés (enquête B V2).'),
    lister_indicateur_non_auto('C1', 'Pas encore de collecte sur les demandes d''accompagnement.'),
    lister_indicateur_non_auto('C2', 'Pas encore de collecte sur les mises en relation.'),
    lister_indicateur_non_auto('C3', 'Pas encore de collecte sur les partenariats économiques.'),
    lister_indicateur_non_auto('C4', 'Pas encore de collecte.'),
    lister_indicateur_non_auto('C5', 'Pas encore de collecte.'),
    lister_indicateur_non_auto('D1', 'Nécessite suivi politiques publiques (collecte qualitative).'),
    lister_indicateur_non_auto('D2', 'Nécessite suivi réformes adoptées.'),
    lister_indicateur_non_auto('D3', 'Nécessite suivi adoption recommandations.'),
    lister_indicateur_non_auto('F1', 'Nécessite question dédiée sur l''apport du français (enquête F).')
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
-- Helper : assemble la structure d'un indicateur non-auto en lisant ses saisies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lister_indicateur_non_auto(
  p_code TEXT,
  p_mention_si_vide TEXT
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
  -- Lecture des saisies pour cet indicateur
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
      'source', 'saisie'
    ) ORDER BY annee),
    COUNT(*),
    -- derniere valeur (par annee desc, première)
    (SELECT COALESCE(
      v.valeur_directe,
      CASE WHEN v.denominateur IS NOT NULL AND v.denominateur > 0
        THEN ROUND(100.0 * v.numerateur / v.denominateur, 1)
        ELSE v.numerateur
      END
    )
    FROM public.valeurs_indicateurs_saisies v
    WHERE v.indicateur_code = p_code
    ORDER BY v.annee DESC LIMIT 1),
    (SELECT v.annee FROM public.valeurs_indicateurs_saisies v
     WHERE v.indicateur_code = p_code ORDER BY v.annee DESC LIMIT 1)
  INTO v_valeurs, v_nb, v_derniere_valeur, v_derniere_annee
  FROM public.valeurs_indicateurs_saisies
  WHERE indicateur_code = p_code;

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

GRANT EXECUTE ON FUNCTION public.lister_indicateur_non_auto(TEXT, TEXT) TO authenticated;
