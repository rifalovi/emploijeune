-- =============================================================================
-- Migration — Valeurs d'ensemble issues du Rapport intermédiaire d'enquête 2026
-- -----------------------------------------------------------------------------
-- Source : « Documentation des résultats de l'emploi des jeunes dans les projets
-- de l'OIF — Rapport intermédiaire d'enquête » (Service Conception et Suivi,
-- juin 2026). Synthèse des indicateurs — valeurs d'ENSEMBLE (tous projets).
--
-- Seuls les indicateurs NON auto-calculables sont renseignés ici. A1 (nombre
-- de personnes formées) et B1 (structures appuyées) restent calculés
-- automatiquement depuis les tables `beneficiaires` / `structures` et ne sont
-- donc PAS écrasés.
--
-- Les valeurs sont publiées (`publie = TRUE`) pour être visibles immédiatement.
-- Année de référence : 2026 (enquête intermédiaire, périmètre 2024–2026).
-- Idempotent : ON CONFLICT met à jour la valeur existante.
-- =============================================================================

INSERT INTO public.valeurs_indicateurs_saisies
  (indicateur_code, annee, numerateur, denominateur, valeur_directe, note, publie, published_at)
VALUES
  ('A2', 2026, NULL, NULL, 88.4,  'Rapport intermédiaire d''enquête — juin 2026 (taux d''achèvement, ensemble).', TRUE, now()),
  ('A3', 2026, NULL, NULL, 76.47, 'Rapport intermédiaire d''enquête — juin 2026 (taux de certification, ensemble).', TRUE, now()),
  ('A4', 2026, NULL, NULL, 78.55, 'Rapport intermédiaire d''enquête — juin 2026 (gain de compétences, ensemble).', TRUE, now()),
  ('A5', 2026, NULL, NULL, 41.18, 'Rapport intermédiaire d''enquête — juin 2026 (taux d''insertion 6/12 mois, ensemble).', TRUE, now()),
  ('B2', 2026, NULL, NULL, 94.81, 'Rapport intermédiaire d''enquête — juin 2026 (taux de survie 12/24 mois, ensemble).', TRUE, now()),
  ('B3', 2026, NULL, NULL, 3574,  'Rapport intermédiaire d''enquête — juin 2026 (emplois créés ou maintenus, ensemble).', TRUE, now()),
  ('B4', 2026, NULL, NULL, 1464,  'Rapport intermédiaire d''enquête — juin 2026 (emplois indirects estimés, ensemble).', TRUE, now()),
  ('F1', 2026, NULL, NULL, 82.90, 'Rapport intermédiaire d''enquête — juin 2026 (apport du français à l''employabilité, ensemble).', TRUE, now())
ON CONFLICT (indicateur_code, annee) DO UPDATE
SET valeur_directe = EXCLUDED.valeur_directe,
    numerateur     = EXCLUDED.numerateur,
    denominateur   = EXCLUDED.denominateur,
    note           = EXCLUDED.note,
    publie         = TRUE,
    published_at   = now(),
    updated_at     = now();
