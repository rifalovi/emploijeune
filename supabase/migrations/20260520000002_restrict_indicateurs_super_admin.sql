-- =============================================================================
-- Migration — Restriction des RPCs indicateurs au rôle super_admin uniquement
-- -----------------------------------------------------------------------------
-- Toutes les opérations de modification manuelle des indicateurs
-- (saisie valeurs, suppression, publication, KPIs contextuels, masquage)
-- sont désormais réservées au super_admin.
--
-- Avant : admin_scs OU super_admin
-- Après : super_admin UNIQUEMENT
--
-- 🟢 Risque zéro : les server actions Next.js ont déjà été mises à jour.
--    Cette migration renforce la sécurité côté base (défense en profondeur).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper privé : vérifie que l'utilisateur courant est super_admin
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND actif = TRUE
      AND deleted_at IS NULL
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. enregistrer_saisie_indicateur — super_admin uniquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enregistrer_saisie_indicateur(
  p_code             TEXT,
  p_annee            INTEGER,
  p_numerateur       NUMERIC DEFAULT NULL,
  p_denominateur     NUMERIC DEFAULT NULL,
  p_valeur_directe   NUMERIC DEFAULT NULL,
  p_note             TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  INSERT INTO public.valeurs_indicateurs_saisies
    (indicateur_code, annee, numerateur, denominateur, valeur_directe, note, updated_by)
  VALUES
    (p_code, p_annee, p_numerateur, p_denominateur, p_valeur_directe, p_note, auth.uid())
  ON CONFLICT (indicateur_code, annee) DO UPDATE SET
    numerateur     = EXCLUDED.numerateur,
    denominateur   = EXCLUDED.denominateur,
    valeur_directe = EXCLUDED.valeur_directe,
    note           = EXCLUDED.note,
    updated_at     = NOW(),
    updated_by     = auth.uid();

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'annee', p_annee);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. supprimer_saisie_indicateur — super_admin uniquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.supprimer_saisie_indicateur(
  p_code  TEXT,
  p_annee INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  DELETE FROM public.valeurs_indicateurs_saisies
  WHERE indicateur_code = p_code AND annee = p_annee;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RETURN jsonb_build_object('erreur', 'saisie_introuvable', 'code', p_code, 'annee', p_annee);
  END IF;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'annee', p_annee);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. basculer_publi_saisie_valeur — super_admin uniquement
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
  v_affected INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  UPDATE public.valeurs_indicateurs_saisies
  SET publie       = p_publie,
      published_at = CASE WHEN p_publie THEN NOW() ELSE NULL END,
      published_by = CASE WHEN p_publie THEN auth.uid() ELSE NULL END,
      updated_at   = NOW(),
      updated_by   = auth.uid()
  WHERE indicateur_code = p_code AND annee = p_annee;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RETURN jsonb_build_object('erreur', 'saisie_introuvable', 'code', p_code, 'annee', p_annee);
  END IF;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'annee', p_annee, 'publie', p_publie);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. masquer_annee_indicateur — super_admin uniquement
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.masquer_annee_indicateur(
  p_code    TEXT,
  p_annee   INTEGER,
  p_masquer BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  IF p_code NOT IN ('A1', 'B1', 'B4') THEN
    RETURN jsonb_build_object('erreur', 'masquage_non_supporte', 'code', p_code,
      'detail', 'Seuls A1, B1 et B4 supportent le masquage par année.');
  END IF;

  IF p_masquer THEN
    UPDATE public.indicateurs_config
    SET annees_masquees = array_append(annees_masquees, p_annee)
    WHERE indicateur_code = p_code
      AND NOT (p_annee = ANY(annees_masquees));
  ELSE
    UPDATE public.indicateurs_config
    SET annees_masquees = array_remove(annees_masquees, p_annee)
    WHERE indicateur_code = p_code;
  END IF;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'annee', p_annee, 'masque', p_masquer);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. toggle_indicateur_visu — déjà super_admin, on confirme
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_indicateur_visu(
  p_code        TEXT,
  p_visu_forcee BOOLEAN,
  p_valeur      BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('erreur', 'non_authentifie');
  END IF;
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('erreur', 'reserve_super_admin');
  END IF;

  UPDATE public.indicateurs_config
  SET visu_forcee  = p_visu_forcee,
      visu_activee = p_valeur,
      updated_at   = NOW()
  WHERE indicateur_code = p_code;

  RETURN jsonb_build_object('succes', TRUE, 'code', p_code, 'visu_activee', p_valeur);
END;
$$;

-- Révoquer l'accès execute aux roles non-admin pour ces fonctions sensibles
REVOKE EXECUTE ON FUNCTION public.enregistrer_saisie_indicateur FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.supprimer_saisie_indicateur FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.basculer_publi_saisie_valeur FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.masquer_annee_indicateur FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_indicateur_visu FROM PUBLIC;

-- Ré-autoriser uniquement les utilisateurs authentifiés (la vérification
-- super_admin se fait à l'intérieur de chaque fonction via is_super_admin())
GRANT EXECUTE ON FUNCTION public.enregistrer_saisie_indicateur TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_saisie_indicateur TO authenticated;
GRANT EXECUTE ON FUNCTION public.basculer_publi_saisie_valeur TO authenticated;
GRANT EXECUTE ON FUNCTION public.masquer_annee_indicateur TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_indicateur_visu TO authenticated;
