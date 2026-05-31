-- =============================================================================
-- Migration 20260531000003 — Phase 2.3 : alertes pays_null
-- -----------------------------------------------------------------------------
-- Pourquoi : 4 beneficiaires ont pays_code IS NULL. Insere une alerte qualite
--   par ligne pour que le workflow de resolution manuelle puisse les traiter.
--
-- Idempotent : utilise ON CONFLICT sur l'index partiel uq_alertes_qualite_benef
--   (type, beneficiaire_id) WHERE beneficiaire_id IS NOT NULL.
--   Si les alertes existent deja (insertion manuelle prealable), rien ne se passe.
-- =============================================================================

INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
SELECT
  'pays_null',
  'avertissement',
  b.id,
  b.projet_code,
  'Pays manquant — correction manuelle requise.'
FROM public.beneficiaires b
WHERE b.pays_code IS NULL
  AND b.deleted_at IS NULL
ON CONFLICT (type, beneficiaire_id) WHERE beneficiaire_id IS NOT NULL
DO NOTHING;
