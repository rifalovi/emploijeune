-- Migration : colonnes de précision pour les modalités "Autre" dans structures
-- Applique via : supabase db push  (depuis le dossier EMPLOIJEUNE avec CLI Supabase)

ALTER TABLE public.structures
  ADD COLUMN IF NOT EXISTS type_structure_autre TEXT,
  ADD COLUMN IF NOT EXISTS nature_appui_autre   TEXT;

COMMENT ON COLUMN public.structures.type_structure_autre IS
  'Précision libre quand type_structure_code = ''AUTRE''';
COMMENT ON COLUMN public.structures.nature_appui_autre IS
  'Précision libre quand nature_appui_code = ''AUTRE''';
