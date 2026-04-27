-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 020 : hotfix v1.2.6.1
-- -----------------------------------------------------------------------------
-- Le hotfix v1.2.6 (migration 019) a introduit les fonctions
-- upsert_beneficiaire_import et upsert_structure_import avec une garde
-- rôle stricte « admin_scs uniquement ». Cette garde rejette les appels
-- service_role utilisés par les scripts d'import : auth.uid() est NULL
-- pour service_role → v_role NULL → exception « Réservé aux
-- administrateurs SCS ».
--
-- Décision Carlos : la sécurité d'un script d'import s'appuie déjà sur
--   1. SECURITY DEFINER (la fonction s'exécute avec les droits du
--      créateur, pas de l'appelant).
--   2. GRANT EXECUTE qui contrôle qui peut invoquer la fonction.
--   3. Le fait que seuls les admins ayant la SUPABASE_SERVICE_ROLE_KEY
--      en variable d'environnement peuvent lancer le script.
--
-- Conséquence : on retire la double-garde rôle métier. La fonction
-- accepte désormais :
--   • Les appels service_role (auth.uid() IS NULL).
--   • Les appels admin_scs authentifiés (futurs cas d'usage UI).
-- Tout autre rôle authentifié reste rejeté pour éviter qu'un editeur
-- ou contributeur connecté n'invoque la RPC d'import depuis le client.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_beneficiaire_import(
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

  -- Cas 1 : appel service_role (script d'import) → auth.uid() est NULL,
  -- la sécurité repose sur SECURITY DEFINER + GRANT EXECUTE.
  -- Cas 2 : appel admin_scs authentifié (UI future) → on vérifie le rôle.
  -- Cas 3 : tout autre utilisateur authentifié → rejet explicite.
  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.utilisateurs
    WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
    LIMIT 1;

    IF v_role IS NULL OR v_role <> 'admin_scs' THEN
      RAISE EXCEPTION 'Réservé aux administrateurs SCS ou aux scripts service_role';
    END IF;
  END IF;

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

COMMENT ON FUNCTION public.upsert_beneficiaire_import IS
  'Hotfix v1.2.6.1 : accepte les appels service_role (auth.uid() NULL) en plus des admin_scs authentifiés. La sécurité repose sur SECURITY DEFINER + GRANT EXECUTE — un editeur/contributeur authentifié reste rejeté.';

COMMENT ON FUNCTION public.upsert_structure_import IS
  'Hotfix v1.2.6.1 : idem upsert_beneficiaire_import — accepte service_role pour les scripts d''import.';
