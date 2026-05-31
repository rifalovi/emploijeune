-- =============================================================================
-- Migration 20260531000005 — Phase 2.4 : resolution des beneficiaires pays ZZZ
-- -----------------------------------------------------------------------------
-- Pourquoi : 128 beneficiaires ont pays_code = 'ZZZ' (code de repli quand le
--   smart-mapper n'a pas resolu le pays a l'import). C'est 100% du gap pays
--   significatif et 60% du gap tranche d'age. Cette migration :
--   1. Cree les RPC de correction (unitaire, bulk, ignorer)
--   2. Insere 128 alertes qualite pour le workflow de resolution
--
-- Table de reference : public.pays (code_iso, libelle_fr).
-- Table d'audit : public.journaux_audit (action enum action_audit).
-- =============================================================================


-- ── 1. RPC corriger_pays_beneficiaire ────────────────────────────────────────
-- Corrige le pays d'UN beneficiaire ZZZ et marque l'alerte qualite resolue.

CREATE OR REPLACE FUNCTION public.corriger_pays_beneficiaire(
  p_beneficiaire_id UUID,
  p_nouveau_pays_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pays_existe BOOLEAN;
  v_ancien_pays TEXT;
BEGIN
  -- Seuls admin_scs / super_admin
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  -- Verifier que le nouveau code existe dans le referentiel et n'est pas ZZZ
  SELECT EXISTS(
    SELECT 1 FROM public.pays
    WHERE code_iso = p_nouveau_pays_code AND code_iso <> 'ZZZ'
  ) INTO v_pays_existe;

  IF NOT v_pays_existe THEN
    RAISE EXCEPTION 'Code pays % invalide ou non autorise (ZZZ refuse).', p_nouveau_pays_code;
  END IF;

  -- Recuperer l'ancien pays pour le journal
  SELECT pays_code INTO v_ancien_pays
  FROM public.beneficiaires
  WHERE id = p_beneficiaire_id AND deleted_at IS NULL;

  -- Corriger le pays (garde-fou : ne corrige QUE les ZZZ)
  UPDATE public.beneficiaires
  SET pays_code = p_nouveau_pays_code,
      updated_at = NOW()
  WHERE id = p_beneficiaire_id
    AND pays_code = 'ZZZ'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Marquer l'alerte qualite comme resolue
  UPDATE public.alertes_qualite
  SET statut = 'resolu',
      resolu_par = auth.uid(),
      resolu_le = NOW(),
      note_resolution = 'Pays corrige : ' || v_ancien_pays || ' -> ' || p_nouveau_pays_code
  WHERE beneficiaire_id = p_beneficiaire_id
    AND type = 'pays_zzz'
    AND statut IN ('ouvert', 'en_cours');

  -- Journal d'audit
  INSERT INTO public.journaux_audit (table_affectee, ligne_id, action, diff, user_id, horodatage)
  VALUES (
    'beneficiaires',
    p_beneficiaire_id,
    'UPDATE',
    jsonb_build_object(
      'champ', 'pays_code',
      'avant', v_ancien_pays,
      'apres', p_nouveau_pays_code,
      'contexte', 'resolution_zzz'
    ),
    auth.uid(),
    NOW()
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corriger_pays_beneficiaire(UUID, TEXT) TO authenticated;


-- ── 2. RPC corriger_pays_bulk ────────────────────────────────────────────────
-- Corrige le pays de N beneficiaires ZZZ en une seule operation.

CREATE OR REPLACE FUNCTION public.corriger_pays_bulk(
  p_beneficiaire_ids UUID[],
  p_nouveau_pays_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pays_existe BOOLEAN;
  v_nb_corriges INTEGER;
  v_nb_alertes  INTEGER;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.pays
    WHERE code_iso = p_nouveau_pays_code AND code_iso <> 'ZZZ'
  ) INTO v_pays_existe;

  IF NOT v_pays_existe THEN
    RAISE EXCEPTION 'Code pays % invalide ou non autorise.', p_nouveau_pays_code;
  END IF;

  -- Corriger tous les beneficiaires selectionnes (uniquement les ZZZ)
  UPDATE public.beneficiaires
  SET pays_code = p_nouveau_pays_code,
      updated_at = NOW()
  WHERE id = ANY(p_beneficiaire_ids)
    AND pays_code = 'ZZZ'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_nb_corriges = ROW_COUNT;

  -- Marquer les alertes comme resolues
  UPDATE public.alertes_qualite
  SET statut = 'resolu',
      resolu_par = auth.uid(),
      resolu_le = NOW(),
      note_resolution = 'Correction bulk : pays -> ' || p_nouveau_pays_code
  WHERE beneficiaire_id = ANY(p_beneficiaire_ids)
    AND type = 'pays_zzz'
    AND statut IN ('ouvert', 'en_cours');

  GET DIAGNOSTICS v_nb_alertes = ROW_COUNT;

  -- Journal d'audit (une seule entree pour le lot)
  INSERT INTO public.journaux_audit (table_affectee, ligne_id, action, diff, user_id, horodatage)
  VALUES (
    'beneficiaires',
    p_beneficiaire_ids[1],  -- reference la premiere ligne du lot
    'UPDATE',
    jsonb_build_object(
      'champ', 'pays_code',
      'avant', 'ZZZ',
      'apres', p_nouveau_pays_code,
      'contexte', 'resolution_zzz_bulk',
      'nb_lignes', v_nb_corriges,
      'ids', to_jsonb(p_beneficiaire_ids)
    ),
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'corriges', v_nb_corriges,
    'alertes_resolues', v_nb_alertes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.corriger_pays_bulk(UUID[], TEXT) TO authenticated;


-- ── 3. RPC ignorer_alerte_pays_zzz ──────────────────────────────────────────
-- Marque une alerte pays_zzz comme ignoree (donnees insuffisantes).

CREATE OR REPLACE FUNCTION public.ignorer_alerte_pays_zzz(
  p_beneficiaire_id UUID,
  p_note TEXT DEFAULT 'Donnees insuffisantes pour resoudre'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.alertes_qualite
  SET statut = 'ignore',
      resolu_par = auth.uid(),
      resolu_le = NOW(),
      note_resolution = p_note
  WHERE beneficiaire_id = p_beneficiaire_id
    AND type = 'pays_zzz'
    AND statut IN ('ouvert', 'en_cours');

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ignorer_alerte_pays_zzz(UUID, TEXT) TO authenticated;


-- ── 4. RPC ignorer_alertes_bulk ─────────────────────────────────────────────
-- Version bulk de l'ignorement (pour les 37 "Nom inconnu" par exemple).

CREATE OR REPLACE FUNCTION public.ignorer_alertes_pays_zzz_bulk(
  p_beneficiaire_ids UUID[],
  p_note TEXT DEFAULT 'Donnees insuffisantes pour resoudre'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nb INTEGER;
BEGIN
  IF NOT public.is_admin_scs() THEN
    RAISE EXCEPTION 'Action reservee aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.alertes_qualite
  SET statut = 'ignore',
      resolu_par = auth.uid(),
      resolu_le = NOW(),
      note_resolution = p_note
  WHERE beneficiaire_id = ANY(p_beneficiaire_ids)
    AND type = 'pays_zzz'
    AND statut IN ('ouvert', 'en_cours');

  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ignorer_alertes_pays_zzz_bulk(UUID[], TEXT) TO authenticated;


-- ── 5. Insertion des 128 alertes pays_zzz (idempotent) ──────────────────────

INSERT INTO public.alertes_qualite (
  type, severite, beneficiaire_id, projet_code, message
)
SELECT
  'pays_zzz',
  'avertissement',
  b.id,
  b.projet_code,
  'Pays non resolu a l''import (code ZZZ). Correction manuelle requise.'
FROM public.beneficiaires b
WHERE b.pays_code = 'ZZZ'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.alertes_qualite a
    WHERE a.beneficiaire_id = b.id AND a.type = 'pays_zzz'
  );
