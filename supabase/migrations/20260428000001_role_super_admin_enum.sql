-- =============================================================================
-- v2.0.0 — Étend l'ENUM role_utilisateur avec 'super_admin'
-- -----------------------------------------------------------------------------
-- Le super_admin est un rôle exclusif (Carlos seul) supérieur à admin_scs.
-- Il a accès à des fonctions exclusives : tracking étendu, suspension /
-- archivage, activation des modules optionnels (IA), etc.
--
-- Cette migration ajoute UNIQUEMENT la valeur à l'ENUM. Elle DOIT s'exécuter
-- AVANT toute migration qui utilise 'super_admin' dans une expression SQL,
-- car PostgreSQL refuse l'usage d'une valeur d'ENUM dans la transaction où
-- elle a été ajoutée.
-- =============================================================================

ALTER TYPE public.role_utilisateur ADD VALUE IF NOT EXISTS 'super_admin';
