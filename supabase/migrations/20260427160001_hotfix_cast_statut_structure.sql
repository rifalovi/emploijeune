-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 021 : hotfix v1.2.6.2
-- -----------------------------------------------------------------------------
-- Cast manquant : `statut_creation` est de type `public.statut_structure`
-- (ENUM) mais la fonction upsert_structure_import (migration 019/020)
-- passait p_payload->>'statut_creation' en TEXT brut. PostgreSQL refuse
-- la coercion implicite ENUM ← TEXT :
--
--   ERROR: column "statut_creation" is of type statut_structure
--          but expression is of type text
--
-- Fix : cast explicite ::public.statut_structure dans le INSERT.
--
-- Audit des autres colonnes ENUM de la table structures :
--   • porteur_sexe       → public.sexe        (déjà casté ✓)
--   • source_import      → public.source_import (déjà casté ✓)
--   • statut_creation    → public.statut_structure (CORRIGÉ ICI)
--
-- Pour la table beneficiaires, le bug ne s'est pas manifesté car la
-- seule ENUM (sexe) était déjà castée via (p_payload->>'sexe')::public.sexe.
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
  v_uid UUID;
  v_role public.role_utilisateur;
  v_inserted_id UUID;
BEGIN
  v_uid := auth.uid();

  -- Garde rôle conditionnelle (cf. v1.2.6.1) :
  --   • service_role (auth.uid() IS NULL) → bypass.
  --   • UI authentifiée → check admin_scs strict.
  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.utilisateurs
    WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
    LIMIT 1;

    IF v_role IS NULL OR v_role <> 'admin_scs' THEN
      RAISE EXCEPTION 'Réservé aux administrateurs SCS ou aux scripts service_role';
    END IF;
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
    -- HOTFIX v1.2.6.2 : cast explicite ENUM (était TEXT brut → erreur de
    -- coercion).
    (p_payload->>'statut_creation')::public.statut_structure,
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

COMMENT ON FUNCTION public.upsert_structure_import IS
  'Hotfix v1.2.6.2 : ajout du cast explicite (TEXT)::public.statut_structure pour la colonne statut_creation. Les autres ENUM (sexe, source_import) étaient déjà castées correctement.';
