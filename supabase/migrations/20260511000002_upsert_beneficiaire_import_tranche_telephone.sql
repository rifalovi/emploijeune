-- Migration : ajoute tranche_age_declaree + telephone à upsert_beneficiaire_import
--
-- Contexte : la migration 20260511000001 a ajouté la colonne
-- tranche_age_declaree, et le script d'import (scripts/import-base-reelle/
-- import-beneficiaires.mjs v1.2.0) passe désormais tranche_age_declaree
-- + telephone dans le payload JSONB. Mais la fonction RPC
-- upsert_beneficiaire_import (définie dans migration 20260427150001)
-- n'incluait pas ces deux colonnes dans son INSERT — elles étaient donc
-- silencieusement ignorées.
--
-- De plus, le ON CONFLICT DO NOTHING ne mettait jamais à jour les lignes
-- déjà importées. Sur la base de sondage initiale OIF (5513 bénéficiaires),
-- cela signifie qu'AUCUNE ligne existante n'a vu sa tranche_age_declaree
-- ou son telephone mis à jour, malgré plusieurs réexécutions du script.
--
-- Ce hotfix :
--   1. Ajoute tranche_age_declaree + telephone dans la liste INSERT
--   2. Remplace DO NOTHING par DO UPDATE SET ... = COALESCE(existant, nouveau)
--      sur ces 2 colonnes UNIQUEMENT, pour combler les NULL sans écraser
--      d'éventuelles corrections manuelles ultérieures.
--   3. Renvoie un statut 'updated' supplémentaire (en plus de 'inserted' /
--      'conflicted') pour la traçabilité côté script.

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
  v_existing_id UUID;
  v_tranche_avant TEXT;
  v_tel_avant TEXT;
  v_tranche_apres TEXT;
  v_tel_apres TEXT;
  v_was_inserted BOOLEAN;
  v_was_updated BOOLEAN := FALSE;
BEGIN
  v_uid := auth.uid();

  -- Garde rôle identique à la v1.2.6.1 (cf. 20260427150001_hotfix_upsert_role_check.sql).
  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.utilisateurs
    WHERE user_id = v_uid AND actif = TRUE AND deleted_at IS NULL
    LIMIT 1;

    IF v_role IS NULL OR v_role NOT IN ('admin_scs', 'super_admin') THEN
      RAISE EXCEPTION 'Réservé aux administrateurs SCS / super_admin ou aux scripts service_role';
    END IF;
  END IF;

  -- Récupère la ligne existante AVANT pour distinguer insert vs update.
  SELECT id, tranche_age_declaree, telephone
    INTO v_existing_id, v_tranche_avant, v_tel_avant
  FROM public.beneficiaires
  WHERE import_source = p_payload->>'import_source'
    AND import_index  = (p_payload->>'import_index')::INTEGER
  LIMIT 1;

  INSERT INTO public.beneficiaires (
    prenom, nom, sexe, projet_code, pays_code,
    domaine_formation_code, intitule_formation, annee_formation,
    date_debut_formation, statut_code, fonction_actuelle,
    partenaire_accompagnement, courriel,
    telephone,
    tranche_age_declaree,
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
    NULLIF(p_payload->>'telephone', ''),
    NULLIF(p_payload->>'tranche_age_declaree', ''),
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
  DO UPDATE SET
    -- Backfill UNIQUEMENT sur les 2 colonnes en rattrapage,
    -- COALESCE pour préserver les corrections manuelles éventuelles.
    tranche_age_declaree = COALESCE(
      public.beneficiaires.tranche_age_declaree,
      NULLIF(EXCLUDED.tranche_age_declaree, '')
    ),
    telephone = COALESCE(
      public.beneficiaires.telephone,
      NULLIF(EXCLUDED.telephone, '')
    )
  RETURNING id, tranche_age_declaree, telephone
  INTO v_inserted_id, v_tranche_apres, v_tel_apres;

  v_was_inserted := (v_existing_id IS NULL);
  IF NOT v_was_inserted THEN
    v_was_updated := (
      (v_tranche_avant IS DISTINCT FROM v_tranche_apres) OR
      (v_tel_avant IS DISTINCT FROM v_tel_apres)
    );
  END IF;

  RETURN jsonb_build_object(
    'inserted',   CASE WHEN v_was_inserted THEN 1 ELSE 0 END,
    'updated',    CASE WHEN v_was_updated THEN 1 ELSE 0 END,
    'conflicted', CASE WHEN (NOT v_was_inserted) AND (NOT v_was_updated) THEN 1 ELSE 0 END,
    'id', v_inserted_id
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_beneficiaire_import IS
  'Hotfix v2.5.2 : ajoute tranche_age_declaree + telephone à l''INSERT, et backfill ces 2 colonnes via DO UPDATE COALESCE sur les lignes existantes. Préserve les corrections manuelles. Renvoie {inserted, updated, conflicted, id}.';
