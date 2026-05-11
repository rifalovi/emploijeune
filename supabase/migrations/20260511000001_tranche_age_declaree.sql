-- Migration : ajout de tranche_age_declaree et telephone sur import
--
-- Contexte : la base de sondage OIF (Excel) ne contient pas de date_naissance
-- mais une catégorie déclarée « Jeune (18-34 ans) » / « Adulte (35 ans et +) »
-- dans la colonne age_groupe. Cette colonne n'était pas importée (champ omis
-- dans le script v1.2.0). On ajoute une colonne de stockage pour cette valeur
-- déclarée, utilisée en affichage quand date_naissance est NULL.
--
-- On corrige également l'absence de mapping du champ `contacts` (téléphone)
-- du CSV vers la colonne `telephone` de la table.

-- 1. Ajout de la colonne tranche_age_declaree
ALTER TABLE public.beneficiaires
  ADD COLUMN IF NOT EXISTS tranche_age_declaree TEXT
  CHECK (tranche_age_declaree IN ('Jeune', 'Adulte'));

COMMENT ON COLUMN public.beneficiaires.tranche_age_declaree IS
  'Tranche d''âge déclarée dans la base de sondage OIF (Excel) :
   « Jeune » = 18-34 ans, « Adulte » = 35 ans et +.
   Utilisée uniquement quand date_naissance est NULL (cas bénéficiaires importés).
   Null pour les bénéficiaires saisis manuellement avec date_naissance.';

-- 2. Index pour les filtres/stats sur la tranche déclarée
CREATE INDEX IF NOT EXISTS idx_beneficiaires_tranche_age_declaree
  ON public.beneficiaires(tranche_age_declaree)
  WHERE deleted_at IS NULL AND tranche_age_declaree IS NOT NULL;
