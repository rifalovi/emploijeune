-- =============================================================================
-- Migration — Configuration des indicateurs affichés sur la vitrine publique
-- -----------------------------------------------------------------------------
-- Brief 1.5 : permettre au super_admin de choisir, sans déploiement, quels
-- indicateurs du Cadre Commun sont affichés dans la section "Données agrégées"
-- de la page d'accueil publique.
--
-- Sécurité :
--   • Lecture publique (rôle anon) : la config et la RPC d'agrégation sont
--     exposées à tous, mais ne renvoient strictement que des agrégats
--     (zéro donnée nominative).
--   • Écriture : super_admin uniquement (cohérent avec la restriction
--     récente sur indicateurs_config — cf. 20260520000002).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.config_vitrine_indicateurs (
  indicateur_code TEXT PRIMARY KEY,
  visible         BOOLEAN NOT NULL DEFAULT FALSE,
  ordre           INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.config_vitrine_indicateurs IS
  'Sélection et ordre d''affichage des indicateurs CMR dans la section "Données agrégées" de la vitrine publique /. Écriture super_admin uniquement.';

-- Pré-remplissage : tous les indicateurs du Cadre Commun (18 codes).
-- Visibles par défaut : A1, A4, A5, B1, B3, B4 (cf. brief 1.5).
INSERT INTO public.config_vitrine_indicateurs (indicateur_code, visible, ordre) VALUES
  ('A1', TRUE,  1),
  ('A2', FALSE, 0),
  ('A3', FALSE, 0),
  ('A4', TRUE,  2),
  ('A5', TRUE,  3),
  ('B1', TRUE,  4),
  ('B2', FALSE, 0),
  ('B3', TRUE,  5),
  ('B4', TRUE,  6),
  ('C1', FALSE, 0),
  ('C2', FALSE, 0),
  ('C3', FALSE, 0),
  ('C4', FALSE, 0),
  ('C5', FALSE, 0),
  ('D1', FALSE, 0),
  ('D2', FALSE, 0),
  ('D3', FALSE, 0),
  ('F1', FALSE, 0)
ON CONFLICT (indicateur_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : lecture publique, écriture super_admin
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.config_vitrine_indicateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_vitrine_lecture_publique
  ON public.config_vitrine_indicateurs
  FOR SELECT
  USING (TRUE);

CREATE POLICY config_vitrine_ecriture_super_admin
  ON public.config_vitrine_indicateurs
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT ON public.config_vitrine_indicateurs TO anon, authenticated;
GRANT UPDATE ON public.config_vitrine_indicateurs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC publique : get_indicateurs_vitrine_v1()
-- -----------------------------------------------------------------------------
-- Retourne pour chaque indicateur visible la valeur agrégée à afficher sur la
-- vitrine. Logique d'agrégation par code :
--   • A1 → total bénéficiaires (toutes années)
--   • B1 → total structures
--   • B4 → somme des montants d'appui
--   • autres → dernière valeur saisie (numerateur ou valeur_directe) pour
--             la plus récente année renseignée dans valeurs_indicateurs_saisies
-- Si aucune valeur n'est disponible, `valeur` vaut NULL → la vitrine affiche "—".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_indicateurs_vitrine_v1()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultat JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY ordre_val), '[]'::JSONB)
  INTO v_resultat
  FROM (
    SELECT
      c.ordre AS ordre_val,
      jsonb_build_object(
        'code',   c.indicateur_code,
        'ordre',  c.ordre,
        'valeur', (
          CASE c.indicateur_code
            WHEN 'A1' THEN (
              SELECT COUNT(*)::NUMERIC
              FROM public.beneficiaires
              WHERE deleted_at IS NULL
            )
            WHEN 'B1' THEN (
              SELECT COUNT(*)::NUMERIC
              FROM public.structures
              WHERE deleted_at IS NULL
            )
            WHEN 'B4' THEN (
              SELECT COALESCE(SUM(montant_appui), 0)::NUMERIC
              FROM public.structures
              WHERE deleted_at IS NULL
            )
            ELSE (
              SELECT COALESCE(v.valeur_directe, v.numerateur)::NUMERIC
              FROM public.valeurs_indicateurs_saisies v
              WHERE v.indicateur_code = c.indicateur_code
              ORDER BY v.annee DESC
              LIMIT 1
            )
          END
        )
      ) AS item
    FROM public.config_vitrine_indicateurs c
    WHERE c.visible = TRUE
  ) sub;

  RETURN v_resultat;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicateurs_vitrine_v1() TO anon, authenticated;

COMMENT ON FUNCTION public.get_indicateurs_vitrine_v1 IS
  'Valeurs agrégées des indicateurs CMR sélectionnés pour la vitrine publique. Exposable au rôle anon — zéro donnée nominative.';
