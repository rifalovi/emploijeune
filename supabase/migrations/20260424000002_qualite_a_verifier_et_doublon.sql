-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 007 :
-- Colonne générée qualite_a_verifier + fonction find_beneficiaire_doublon
-- -----------------------------------------------------------------------------
-- Décisions Étape 4c :
--   Q2 : warning non bloquant côté UI + flag qualite_a_verifier calculé en DB
--        pour les incohérences « statut achevé/abandon + date_fin manquante ».
--   Q7 : détection doublon BLOQUANTE avant INSERT via la fonction SQL
--        find_beneficiaire_doublon (SECURITY INVOKER, respecte la RLS —
--        un doublon hors périmètre ne sera pas exposé).
-- =============================================================================

-- 1. Colonne générée qualite_a_verifier ----------------------------------------
-- TRUE quand le statut indique fin de parcours (FORMATION_ACHEVEE ou ABANDON)
-- mais que la date_fin_formation est absente.
ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS qualite_a_verifier BOOLEAN
    GENERATED ALWAYS AS (
      statut_code IN ('FORMATION_ACHEVEE', 'ABANDON')
      AND date_fin_formation IS NULL
    ) STORED;

COMMENT ON COLUMN public.beneficiaires.qualite_a_verifier IS
  'Colonne générée : TRUE si statut = FORMATION_ACHEVEE ou ABANDON ET date_fin_formation est NULL. Permet au dashboard admin de lister les fiches à compléter. Mise à jour automatique par PostgreSQL à chaque INSERT/UPDATE.';

-- Index partiel pour lister rapidement les fiches à corriger (alertes qualité
-- du dashboard admin_scs : get_kpis_dashboard_admin_scs).
CREATE INDEX IF NOT EXISTS idx_beneficiaires_qualite_a_verifier
  ON public.beneficiaires(qualite_a_verifier)
  WHERE deleted_at IS NULL AND qualite_a_verifier = TRUE;

-- 2. Mise à jour de la fonction KPI admin pour inclure ces alertes --------------
-- On remplace l'ancien calcul « consentement sans date + date_naissance manquante
-- + structures sans montant » par un calcul enrichi qui inclut les
-- incohérences statut/date.
CREATE OR REPLACE FUNCTION public.get_kpis_dashboard_admin_scs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comptes_en_attente INTEGER;
  v_beneficiaires_total INTEGER;
  v_beneficiaires_consent INTEGER;
  v_taux_rgpd NUMERIC;
  v_alertes INTEGER;
  v_imports_recents INTEGER;
  v_imports_avec_erreurs INTEGER;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RETURN jsonb_build_object('erreur', 'acces_refuse');
  END IF;

  SELECT COUNT(*) INTO v_comptes_en_attente
  FROM public.utilisateurs
  WHERE statut_validation = 'en_attente' AND deleted_at IS NULL;

  SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL),
         COUNT(*) FILTER (WHERE consentement_recueilli = TRUE AND deleted_at IS NULL)
    INTO v_beneficiaires_total, v_beneficiaires_consent
  FROM public.beneficiaires;

  v_taux_rgpd := CASE
    WHEN v_beneficiaires_total = 0 THEN 0
    ELSE ROUND(100.0 * v_beneficiaires_consent / v_beneficiaires_total, 1)
  END;

  SELECT
    (SELECT COUNT(*) FROM public.beneficiaires
      WHERE deleted_at IS NULL AND consentement_recueilli = TRUE AND consentement_date IS NULL)
    + (SELECT COUNT(*) FROM public.beneficiaires
       WHERE deleted_at IS NULL AND date_naissance IS NULL)
    + (SELECT COUNT(*) FROM public.beneficiaires
       WHERE deleted_at IS NULL AND qualite_a_verifier = TRUE)
    + (SELECT COUNT(*) FROM public.structures
       WHERE deleted_at IS NULL AND montant_appui IS NULL AND nature_appui_code = 'SUBVENTION')
  INTO v_alertes;

  SELECT COUNT(*) INTO v_imports_recents
  FROM public.imports_excel
  WHERE deleted_at IS NULL
    AND demarre_a > NOW() - INTERVAL '7 days'
    AND statut IN ('succes', 'echec_partiel', 'echec_total');

  SELECT COUNT(*) INTO v_imports_avec_erreurs
  FROM public.imports_excel
  WHERE deleted_at IS NULL
    AND demarre_a > NOW() - INTERVAL '7 days'
    AND nb_erreurs > 0;

  RETURN jsonb_build_object(
    'role', 'admin_scs',
    'comptes_en_attente', v_comptes_en_attente,
    'taux_rgpd', jsonb_build_object(
      'valeur', v_taux_rgpd,
      'denominateur', v_beneficiaires_total,
      'alerte', (v_taux_rgpd < 80 AND v_beneficiaires_total > 0)
    ),
    'alertes_qualite', v_alertes,
    'imports_recents', jsonb_build_object(
      'total', v_imports_recents,
      'avec_erreurs', v_imports_avec_erreurs,
      'alerte', (v_imports_avec_erreurs > 0)
    )
  );
END;
$$;

-- 3. Fonction de détection doublon ---------------------------------------------
-- SECURITY INVOKER : RLS appliquée. Un contributeur ne verra pas un doublon
-- dans un projet hors de son périmètre (cas limite : l'INSERT échouera alors
-- sur la contrainte unique, UX à gérer côté app).
--
-- Retourne une ligne si un bénéficiaire avec (prenom, nom, date_naissance, projet)
-- existe déjà (matching accent-insensible + case-insensible).
-- Ne détecte PAS de doublon si p_date_naissance est NULL (par conception —
-- cf. migration 001, index unique partiel).
CREATE OR REPLACE FUNCTION public.find_beneficiaire_doublon(
  p_prenom TEXT,
  p_nom TEXT,
  p_date_naissance DATE,
  p_projet_code TEXT
)
RETURNS TABLE (
  id UUID,
  prenom TEXT,
  nom TEXT,
  date_naissance DATE,
  projet_code TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id, prenom, nom, date_naissance, projet_code
  FROM public.beneficiaires
  WHERE p_date_naissance IS NOT NULL
    AND lower(public.unaccent_immutable(prenom)) = lower(public.unaccent_immutable(p_prenom))
    AND lower(public.unaccent_immutable(nom)) = lower(public.unaccent_immutable(p_nom))
    AND date_naissance = p_date_naissance
    AND projet_code = p_projet_code
    AND deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_beneficiaire_doublon IS
  'Détection de doublon bloquante avant INSERT. Matching accent-insensible + case-insensible sur (prenom, nom, date_naissance, projet_code). SECURITY INVOKER — respecte RLS. Retourne 0 ligne si p_date_naissance est NULL.';

GRANT EXECUTE ON FUNCTION public.find_beneficiaire_doublon(TEXT, TEXT, DATE, TEXT) TO authenticated;
