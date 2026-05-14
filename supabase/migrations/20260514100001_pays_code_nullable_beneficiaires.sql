-- Migration : rendre pays_code nullable dans la table beneficiaires
--
-- Contexte : certains bénéficiaires ont un pays inconnu au moment de la saisie.
-- La valeur NULL représente « pays non renseigné » — sémantiquement correct.
-- La contrainte FK vers pays(code_iso) est conservée : si une valeur est fournie,
-- elle doit être un code ISO valide.
--
-- Impact :
--   - Les requêtes GROUP BY pays_code peuvent désormais retourner une ligne NULL
--     → à traiter comme « Inconnu » dans les visualisations.
--   - Le formulaire de saisie affiche une option « (Pays non renseigné) ».

ALTER TABLE public.beneficiaires
  ALTER COLUMN pays_code DROP NOT NULL;

-- Commentaire descriptif
COMMENT ON COLUMN public.beneficiaires.pays_code IS
  'Code ISO 3166-1 alpha-3 du pays du bénéficiaire. NULL = pays non renseigné.';
