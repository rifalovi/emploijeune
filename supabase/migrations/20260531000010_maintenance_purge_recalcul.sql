-- =============================================================================
-- Migration 20260531000010 — Phase 7 : maintenance plateforme (purge + recalcul)
-- -----------------------------------------------------------------------------
-- Pourquoi : disposer de deux RPC centralisees pour gerer les scenarios de
--   recuperation (base corrompue, reimport, recalcul post-import). Protegees
--   strictement par is_super_admin() — jamais admin_scs.
--
-- Tables purgees (TRUNCATE CASCADE) :
--   - alertes_qualite (FK → beneficiaires, structures)
--   - reponses_enquetes (FK → beneficiaires, structures)
--   - tokens_enquete_publique (FK → beneficiaires, structures)
--   - structure_projet_historique (FK → structures)
--   - valeurs_indicateurs_saisies (autonome)
--   - beneficiaires (FK → import_sessions)
--   - structures
--   - import_sessions
--
-- Tables preservees :
--   - utilisateurs, auth.users, projets, pays, config_vitrine_indicateurs,
--     organisations, campagnes_collecte, documents_publics, journaux_audit,
--     et toutes les tables de configuration/referentiel.
--
-- Decision validee par VIGNON le 31/05/2026.
-- =============================================================================


-- ── 1. RPC purger_donnees_metier_v1 ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purger_donnees_metier_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compteurs JSONB;
  v_uid UUID := auth.uid();
BEGIN
  /* Garde-fou : seuls les super_admin peuvent appeler. */
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action réservée aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  /* Snapshot des effectifs AVANT purge — pour journalisation. */
  SELECT jsonb_build_object(
    'beneficiaires',              (SELECT COUNT(*) FROM public.beneficiaires WHERE deleted_at IS NULL),
    'structures',                 (SELECT COUNT(*) FROM public.structures WHERE deleted_at IS NULL),
    'indicateurs_saisis',         (SELECT COUNT(*) FROM public.valeurs_indicateurs_saisies),
    'alertes_qualite',            (SELECT COUNT(*) FROM public.alertes_qualite),
    'import_sessions',            (SELECT COUNT(*) FROM public.import_sessions),
    'reponses_enquetes',          (SELECT COUNT(*) FROM public.reponses_enquetes),
    'tokens_enquete_publique',    (SELECT COUNT(*) FROM public.tokens_enquete_publique),
    'structure_projet_historique', (SELECT COUNT(*) FROM public.structure_projet_historique)
  ) INTO v_compteurs;

  /* Purge. TRUNCATE CASCADE resout les FK automatiquement.
     L'ordre explicite garantit la lisibilite — CASCADE fait le reste. */
  TRUNCATE TABLE public.alertes_qualite              RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.reponses_enquetes            RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.tokens_enquete_publique      RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.structure_projet_historique   RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.valeurs_indicateurs_saisies  RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.beneficiaires                RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.structures                   RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.import_sessions              RESTART IDENTITY CASCADE;

  /* Trace dans journaux_audit.
     On utilise l'action 'DELETE' (la plus proche semantiquement dans l'enum
     action_audit existant) car l'enum ne contient pas 'PURGE'. */
  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'PURGE_GLOBALE',
    gen_random_uuid(),
    'DELETE',
    jsonb_build_object('effectifs_avant', v_compteurs, 'horodatage', NOW()),
    v_uid,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'effectifs_avant', v_compteurs,
    'message', 'Base vidée. Réimportez vos données puis lancez le recalcul.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purger_donnees_metier_v1() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.purger_donnees_metier_v1() TO authenticated;


-- ── 2. RPC recalculer_indicateurs_v1 ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculer_indicateurs_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultats JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action réservée aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  /* 1. Pas de vues materialisees dans le schema actuel — rien a REFRESH.

     2. Recalcul des alertes qualite : on supprime les alertes auto-generees
        (types connus) et on les regenere a partir de l'etat actuel.
        Les alertes manuelles (types non listes) sont preservees. */

  DELETE FROM public.alertes_qualite
  WHERE type IN ('pays_zzz', 'pays_null', 'tranche_age_null');

  -- Regeneration pays_zzz
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'pays_zzz', 'avertissement', b.id, b.projet_code,
         'Pays non résolu à l''import (code ZZZ). Correction manuelle requise.'
  FROM public.beneficiaires b
  WHERE b.pays_code = 'ZZZ' AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  -- Regeneration pays_null
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'pays_null', 'avertissement', b.id, b.projet_code,
         'Pays manquant — renseigner.'
  FROM public.beneficiaires b
  WHERE b.pays_code IS NULL AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  -- Regeneration tranche_age_null
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'tranche_age_null', 'info', b.id, b.projet_code,
         'Tranche d''âge non renseignée.'
  FROM public.beneficiaires b
  WHERE b.tranche_age_declaree IS NULL AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  /* Compteurs apres recalcul */
  SELECT jsonb_build_object(
    'beneficiaires',    (SELECT COUNT(*) FROM public.beneficiaires WHERE deleted_at IS NULL),
    'structures',       (SELECT COUNT(*) FROM public.structures WHERE deleted_at IS NULL),
    'alertes_generees', (SELECT COUNT(*) FROM public.alertes_qualite
                         WHERE type IN ('pays_zzz','pays_null','tranche_age_null'))
  ) INTO v_resultats;

  /* Trace audit */
  INSERT INTO public.journaux_audit (
    table_affectee, ligne_id, action, diff, user_id, horodatage
  ) VALUES (
    'RECALCUL_INDICATEURS',
    gen_random_uuid(),
    'UPDATE',
    v_resultats,
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object('success', TRUE, 'resultats', v_resultats);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculer_indicateurs_v1() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculer_indicateurs_v1() TO authenticated;
