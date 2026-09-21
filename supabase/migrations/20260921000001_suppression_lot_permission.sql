-- Permission déléguée « Suppression par lot / par projet ».
-- Réservée au super administrateur par défaut ; le super admin peut la déléguer
-- à un administrateur SCS via permissions_delegues (module_key = 'suppression_lot').
-- Concerne la suppression groupée (sélection multiple) et la purge par projet
-- des bénéficiaires et des structures (soft-delete).
--
-- On recrée la contrainte CHECK de module_key pour y inclure 'suppression_lot'
-- (en conservant toutes les clés déjà autorisées).

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
      'data_studio',
      'suppression_lot'
    )
  );
