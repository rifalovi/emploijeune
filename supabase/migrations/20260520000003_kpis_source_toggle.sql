-- =============================================================================
-- Migration — Ajout colonne forcer_manuel dans kpis_contexte_indicateurs
-- -----------------------------------------------------------------------------
-- Permet au super_admin de choisir la source prioritaire des KPIs contextuels
-- pour chaque indicateur :
--   forcer_manuel = FALSE (défaut) → valeurs auto BDD prioritaires
--   forcer_manuel = TRUE           → saisie manuelle prioritaire
--
-- La logique de fusion (mergerKpisContexte) respecte ce flag dans :
--   - lib/realisations/queries.ts
--   - app/(public)/realisations/[pilier]/[indicateur]/page.tsx
--   - app/(dashboard)/indicateurs/[code]/page.tsx
--
-- 🟢 Risque zéro : défaut FALSE = comportement actuel inchangé.
-- =============================================================================

ALTER TABLE public.kpis_contexte_indicateurs
  ADD COLUMN IF NOT EXISTS forcer_manuel BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.kpis_contexte_indicateurs.forcer_manuel IS
  'Si TRUE, la saisie manuelle prend la priorité sur les valeurs auto BDD
   dans mergerKpisContexte(). Défaut FALSE = auto BDD prioritaire.';

-- Mettre à jour la politique d'écriture : super_admin uniquement
-- (cohérent avec la restriction établie en migration 20260520000002)
DROP POLICY IF EXISTS kpis_contexte_write ON public.kpis_contexte_indicateurs;

CREATE POLICY kpis_contexte_write ON public.kpis_contexte_indicateurs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND actif = TRUE
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utilisateurs
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND actif = TRUE
        AND deleted_at IS NULL
    )
  );
