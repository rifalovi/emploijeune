-- =============================================================================
-- Migration — Complète la table public.pays avec TOUS les États
--               et gouvernements OIF (90 entités au total, V2.5.1 chiffres 2025)
-- -----------------------------------------------------------------------------
-- Avant cette migration, la table contenait 61 codes (seed 20260422 + hotfix
-- 20260427140001). Les formulaires de saisie affichaient une liste tronquée :
-- absents notamment Algérie, Chypre, Émirats, Kosovo, Qatar, Polynésie
-- française, Sarre, plus la totalité des observateurs récents.
--
-- Stratégie :
--   - Pour les pays souverains : code ISO-3 standard.
--   - Pour les gouvernements infra-nationaux et entités spéciales : code
--     synthétique 3 lettres (la CHECK contrainte `^[A-Z]{3}$` l'autorise).
--   - Code 'AUT' = Autriche (officiel). Pour éviter conflit avec « Autre »,
--     on garde 'ZZZ' = Non spécifié (déjà présent, actif=FALSE) et on ajoute
--     'ZZA' = Autre (à préciser) pour les formulaires.
-- =============================================================================

INSERT INTO public.pays(code_iso, libelle_fr, ordre_affichage, actif) VALUES
  -- ──────────────────────── MEMBRES manquants ─────────────────────────────
  ('DZA', 'Algérie', 100, TRUE),
  ('CYP', 'Chypre', 101, TRUE),
  ('FWB', 'Fédération Wallonie-Bruxelles (Belgique)', 102, TRUE),
  ('QNB', 'Nouveau-Brunswick (Canada)', 103, TRUE),
  ('QQC', 'Québec (Canada)', 104, TRUE),

  -- ──────────────────────── MEMBRES ASSOCIÉS ──────────────────────────────
  ('ARE', 'Émirats arabes unis', 110, TRUE),
  ('XKX', 'Kosovo', 111, TRUE),
  ('NCL', 'Nouvelle-Calédonie (France)', 112, TRUE),
  ('QAT', 'Qatar', 113, TRUE),

  -- ──────────────────────── OBSERVATEURS ──────────────────────────────────
  ('AGO', 'Angola', 120, TRUE),
  ('AUT', 'Autriche', 121, TRUE),
  ('BIH', 'Bosnie-Herzégovine', 122, TRUE),
  ('QNS', 'Nouvelle-Écosse (Canada)', 123, TRUE),
  ('QON', 'Ontario (Canada)', 124, TRUE),
  ('CHL', 'Chili', 125, TRUE),
  ('KOR', 'Corée du Sud', 126, TRUE),
  ('CRI', 'Costa Rica', 127, TRUE),
  ('HRV', 'Croatie', 128, TRUE),
  ('DMR', 'République dominicaine', 129, TRUE),
  ('EST', 'Estonie', 130, TRUE),
  ('PYF', 'Polynésie française (France)', 131, TRUE),
  ('GMB', 'Gambie', 132, TRUE),
  ('GEO', 'Géorgie', 133, TRUE),
  ('HUN', 'Hongrie', 134, TRUE),
  ('IRL', 'Irlande', 135, TRUE),
  ('LVA', 'Lettonie', 136, TRUE),
  ('LTU', 'Lituanie', 137, TRUE),
  ('LSE', 'Louisiane (États-Unis)', 138, TRUE),
  ('MEX', 'Mexique', 139, TRUE),
  ('MNE', 'Monténégro', 140, TRUE),
  ('MOZ', 'Mozambique', 141, TRUE),
  ('POL', 'Pologne', 142, TRUE),
  ('SAR', 'Sarre (Land allemand)', 143, TRUE),
  ('SVK', 'Slovaquie', 144, TRUE),
  ('SVN', 'Slovénie', 145, TRUE),
  ('CZE', 'République tchèque', 146, TRUE),
  ('THA', 'Thaïlande', 147, TRUE),
  ('URY', 'Uruguay', 148, TRUE),

  -- ──────────────────────── OPTION GÉNÉRIQUE ──────────────────────────────
  ('ZZA', 'Autre (à préciser)', 998, TRUE)
ON CONFLICT (code_iso) DO UPDATE SET
  libelle_fr = EXCLUDED.libelle_fr,
  ordre_affichage = EXCLUDED.ordre_affichage,
  actif = EXCLUDED.actif;

-- Met à jour le commentaire de table : le seed est désormais complet.
COMMENT ON TABLE public.pays IS
  'États et gouvernements de la Francophonie (V2.6 — 90 entités OIF + ZZA Autre + USA/KEN/ETH pour projets emploi-jeunes hors OIF).';
