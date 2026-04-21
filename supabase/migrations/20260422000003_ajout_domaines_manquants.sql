-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Migration 003 : ajout domaine manquant
-- -----------------------------------------------------------------------------
-- Le seed initial comptait 15 domaines au lieu des 16 figurant dans la feuille 5
-- du Template_OIF_Emploi_Jeunes_V1.xlsx. « Services financiers et inclusion »
-- manquait. Ajout ici, idempotent.
-- =============================================================================

INSERT INTO public.domaines_formation(code, libelle, ordre_affichage) VALUES
  ('SERV_FIN_INCLUSION', 'Services financiers et inclusion', 15)
ON CONFLICT (code) DO NOTHING;
