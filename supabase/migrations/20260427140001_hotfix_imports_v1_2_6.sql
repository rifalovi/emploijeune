-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 019 : hotfix v1.2.6 imports
-- -----------------------------------------------------------------------------
-- 4 corrections critiques pour permettre l'import effectif des 5 618 + 341
-- lignes de la base de sondage OIF :
--
--   1. Le SDK Supabase JS .upsert() ne supporte PAS la syntaxe
--      `ON CONFLICT (...) WHERE (...)` requise par PostgreSQL pour les
--      index uniques partiels (cf. migration 017 :
--      idx_beneficiaires_import_idempotence). Diagnostic Carlos confirmé.
--      → Solution : 2 fonctions RPC qui encapsulent la requête INSERT
--      avec la WHERE clause correcte. Les scripts d'import les appellent
--      via supabase.rpc(...) et obtiennent un retour structuré
--      { inserted, conflicted } pour le rapport.
--
--   2. Code pays « ZZZ — Non spécifié » : permet aux scripts d'import de
--      router les lignes sans pays (CSV mal renseigné) vers une valeur
--      sentinelle plutôt que de les rejeter. Décision Carlos « Option B :
--      Fallback Non spécifié ».
--
--   3. Pas de modification de l'index partiel — il fonctionne, c'est juste
--      le SDK qui ne sait pas l'invoquer.
-- =============================================================================

-- 1. Code pays sentinelle « Non spécifié » (ZZZ) + complément Ethiopie / USA
--    (manquants en seed initial mais présents dans certains CSV).
INSERT INTO public.pays(code_iso, libelle_fr, ordre_affichage, actif) VALUES
  ('ZZZ', 'Non spécifié', 999, FALSE),
  ('ETH', 'Éthiopie', 70, TRUE),
  ('USA', 'États-Unis', 71, TRUE)
ON CONFLICT (code_iso) DO UPDATE SET
  libelle_fr = EXCLUDED.libelle_fr,
  ordre_affichage = EXCLUDED.ordre_affichage,
  actif = EXCLUDED.actif;

-- =============================================================================
-- 2. Fonction upsert_beneficiaire_import
-- =============================================================================
--
-- Encapsule l'INSERT...ON CONFLICT...WHERE pour l'idempotence des imports
-- (le SDK Supabase JS ne sait pas piloter une WHERE clause sur un index
-- partiel). Retourne JSONB { inserted: 0|1, conflicted: 0|1 } pour
-- l'agrégation dans le script d'import.
--
-- Sécurité : SECURITY DEFINER + check rôle (admin_scs uniquement, comme
-- pour les autres opérations d'import). Bypass RLS pour les INSERT de
-- masse, audité via le trigger trg_beneficiaires_audit.

CREATE OR REPLACE FUNCTION public.upsert_beneficiaire_import(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_inserted_id UUID;
BEGIN
  -- Garde rôle : admin_scs uniquement
  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = auth.uid() AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role IS NULL OR v_role <> 'admin_scs' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs SCS';
  END IF;

  -- INSERT avec ON CONFLICT sur l'index partiel d'idempotence
  INSERT INTO public.beneficiaires (
    prenom, nom, sexe, projet_code, pays_code,
    domaine_formation_code, intitule_formation, annee_formation,
    date_debut_formation, statut_code, fonction_actuelle,
    partenaire_accompagnement, courriel,
    consentement_recueilli, consentement_date, consentement_origine,
    source_import, import_source, import_batch, import_index
  ) VALUES (
    p_payload->>'prenom',
    p_payload->>'nom',
    (p_payload->>'sexe')::public.sexe,
    p_payload->>'projet_code',
    p_payload->>'pays_code',
    p_payload->>'domaine_formation_code',
    NULLIF(p_payload->>'intitule_formation', ''),
    (p_payload->>'annee_formation')::INTEGER,
    NULLIF(p_payload->>'date_debut_formation', '')::DATE,
    p_payload->>'statut_code',
    NULLIF(p_payload->>'fonction_actuelle', ''),
    NULLIF(p_payload->>'partenaire_accompagnement', ''),
    NULLIF(p_payload->>'courriel', ''),
    COALESCE((p_payload->>'consentement_recueilli')::BOOLEAN, TRUE),
    NULLIF(p_payload->>'consentement_date', '')::DATE,
    NULLIF(p_payload->>'consentement_origine', ''),
    COALESCE((p_payload->>'source_import')::public.source_import, 'excel_v1'),
    p_payload->>'import_source',
    p_payload->>'import_batch',
    (p_payload->>'import_index')::INTEGER
  )
  ON CONFLICT (import_source, import_index)
  WHERE import_source IS NOT NULL AND import_index IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object(
    'inserted', CASE WHEN v_inserted_id IS NOT NULL THEN 1 ELSE 0 END,
    'conflicted', CASE WHEN v_inserted_id IS NULL THEN 1 ELSE 0 END,
    'id', v_inserted_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_beneficiaire_import(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_beneficiaire_import IS
  'Hotfix v1.2.6 : encapsule ON CONFLICT...WHERE pour l''idempotence des imports (le SDK Supabase JS ne sait pas piloter cette syntaxe). Réservé admin_scs.';

-- =============================================================================
-- 3. Fonction upsert_structure_import
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_structure_import(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role_utilisateur;
  v_inserted_id UUID;
BEGIN
  SELECT role INTO v_role
  FROM public.utilisateurs
  WHERE user_id = auth.uid() AND actif = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_role IS NULL OR v_role <> 'admin_scs' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs SCS';
  END IF;

  INSERT INTO public.structures (
    nom_structure, type_structure_code, secteur_activite_code, secteur_precis,
    intitule_initiative, statut_creation, projet_code, pays_code,
    porteur_prenom, porteur_nom, porteur_sexe,
    annee_appui, nature_appui_code, montant_appui,
    telephone_porteur, courriel_porteur,
    consentement_recueilli, consentement_date, consentement_origine,
    source_import, import_source, import_batch, import_index
  ) VALUES (
    p_payload->>'nom_structure',
    p_payload->>'type_structure_code',
    p_payload->>'secteur_activite_code',
    NULLIF(p_payload->>'secteur_precis', ''),
    NULLIF(p_payload->>'intitule_initiative', ''),
    p_payload->>'statut_creation',
    p_payload->>'projet_code',
    p_payload->>'pays_code',
    COALESCE(NULLIF(p_payload->>'porteur_prenom', ''), 'Non'),
    COALESCE(NULLIF(p_payload->>'porteur_nom', ''), 'spécifié'),
    (p_payload->>'porteur_sexe')::public.sexe,
    (p_payload->>'annee_appui')::INTEGER,
    p_payload->>'nature_appui_code',
    NULLIF(p_payload->>'montant_appui', '')::NUMERIC,
    NULLIF(p_payload->>'telephone_porteur', ''),
    NULLIF(p_payload->>'courriel_porteur', ''),
    COALESCE((p_payload->>'consentement_recueilli')::BOOLEAN, TRUE),
    NULLIF(p_payload->>'consentement_date', '')::DATE,
    NULLIF(p_payload->>'consentement_origine', ''),
    COALESCE((p_payload->>'source_import')::public.source_import, 'excel_v1'),
    p_payload->>'import_source',
    p_payload->>'import_batch',
    (p_payload->>'import_index')::INTEGER
  )
  ON CONFLICT (import_source, import_index)
  WHERE import_source IS NOT NULL AND import_index IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object(
    'inserted', CASE WHEN v_inserted_id IS NOT NULL THEN 1 ELSE 0 END,
    'conflicted', CASE WHEN v_inserted_id IS NULL THEN 1 ELSE 0 END,
    'id', v_inserted_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_structure_import(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_structure_import IS
  'Hotfix v1.2.6 : encapsule ON CONFLICT...WHERE pour l''idempotence des imports structures. Réservé admin_scs.';
