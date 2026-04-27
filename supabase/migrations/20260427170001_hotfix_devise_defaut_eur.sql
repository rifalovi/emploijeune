-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 022 : hotfix v1.2.6.3
-- -----------------------------------------------------------------------------
-- Contrainte CHECK violée à l'import structures :
--
--   chk_structures_montant_devise : (montant_appui IS NULL) OR (devise_code IS NOT NULL)
--
-- Conséquence : 339 structures sur 341 rejetées.
--
-- Cause : la base de sondage OIF fournit montant_appui mais pas devise_code
-- (les montants sont implicitement en EUR — financement OIF, siège Paris).
-- Le script ESM ne renseignait pas devise_code dans le payload, donc la
-- contrainte échouait dès qu'un montant était présent.
--
-- Fix dans upsert_structure_import : devise_code par défaut « EUR » si
-- montant_appui IS NOT NULL et devise_code absent du payload. Si
-- montant_appui IS NULL, devise_code reste NULL (cohérence avec la
-- contrainte qui exige NULL/NULL ou montant+devise).
--
-- Décision Carlos confirmée : OIF finance en euros (organisation
-- internationale, siège Paris). Documenté dans
-- docs/migration/migration-base-reelle.md.
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
  v_montant NUMERIC;
  v_devise TEXT;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.utilisateurs
    WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
    LIMIT 1;

    IF v_role IS NULL OR v_role <> 'admin_scs' THEN
      RAISE EXCEPTION 'Réservé aux administrateurs SCS ou aux scripts service_role';
    END IF;
  END IF;

  -- Hotfix v1.2.6.3 : devise_code par défaut EUR si montant présent.
  v_montant := NULLIF(p_payload->>'montant_appui', '')::NUMERIC;
  v_devise := NULLIF(p_payload->>'devise_code', '');
  IF v_montant IS NOT NULL AND v_devise IS NULL THEN
    v_devise := 'EUR';
  END IF;
  IF v_montant IS NULL THEN
    v_devise := NULL; -- cohérence avec chk_structures_montant_devise
  END IF;

  INSERT INTO public.structures (
    nom_structure, type_structure_code, secteur_activite_code, secteur_precis,
    intitule_initiative, statut_creation, projet_code, pays_code,
    porteur_prenom, porteur_nom, porteur_sexe,
    annee_appui, nature_appui_code, montant_appui, devise_code,
    telephone_porteur, courriel_porteur,
    consentement_recueilli, consentement_date, consentement_origine,
    source_import, import_source, import_batch, import_index
  ) VALUES (
    p_payload->>'nom_structure',
    p_payload->>'type_structure_code',
    p_payload->>'secteur_activite_code',
    NULLIF(p_payload->>'secteur_precis', ''),
    NULLIF(p_payload->>'intitule_initiative', ''),
    (p_payload->>'statut_creation')::public.statut_structure,
    p_payload->>'projet_code',
    p_payload->>'pays_code',
    COALESCE(NULLIF(p_payload->>'porteur_prenom', ''), 'Non'),
    COALESCE(NULLIF(p_payload->>'porteur_nom', ''), 'spécifié'),
    (p_payload->>'porteur_sexe')::public.sexe,
    (p_payload->>'annee_appui')::INTEGER,
    p_payload->>'nature_appui_code',
    v_montant,
    v_devise,
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
  'Hotfix v1.2.6.3 : devise_code par défaut EUR si montant_appui présent (financement OIF en euros). Cohérence avec chk_structures_montant_devise (NULL/NULL ou montant+devise).';
