-- Permission déléguée pour le module « SCS DataStudio » (Atelier d'analyse).
-- Le module est réservé au super administrateur par défaut ; le super admin peut
-- l'activer pour un administrateur SCS OU pour n'importe quel utilisateur via la
-- table permissions_delegues (module_key = 'data_studio').
--
-- On recrée la contrainte CHECK de module_key pour y inclure 'data_studio'
-- (ainsi que les clés déjà utilisées par le code mais absentes de la contrainte
-- d'origine : analyses_tcd, realisations).

ALTER TABLE public.permissions_delegues DROP CONSTRAINT IF EXISTS chk_module_key;

ALTER TABLE public.permissions_delegues
  ADD CONSTRAINT chk_module_key CHECK (
    module_key IN (
      'contenu_pages',
      'affichage_public',
      'analyses_indicateurs',
      'base_connaissance',
      'tracking',
      'import_sessions',
      'doublons',
      'nettoyage_donnees',
      'referentiels',
      'analyses_tcd',
      'realisations',
      'data_studio'
    )
  );
