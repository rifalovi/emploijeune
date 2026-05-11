-- =============================================================================
-- Migration — Remplacement em-dash → en-dash dans analyses_indicateurs
-- -----------------------------------------------------------------------------
-- Les analyses Claude générées avant le commit (prompt mis à jour pour
-- interdire l'em-dash) contenaient des — (U+2014) en position d'apposition
-- typographique style anglais ("OIF — Suivi", "A4 — Gain de compétences").
-- L'usage français préfère le – (en-dash U+2013), plus discret.
--
-- Conversion uniforme : tous les — en — par —. Idempotent.
-- Concerne `contenu` (le Markdown affiché) et `resume` (l'accroche, déjà
-- nettoyée à NULL pour la plupart par migration 20260511300001 mais on
-- patche par sécurité pour les futures regénérations).
-- =============================================================================

UPDATE public.analyses_indicateurs
SET contenu = replace(contenu, E'\\u2014', E'\\u2013')
WHERE contenu LIKE '%' || E'\\u2014' || '%';

UPDATE public.analyses_indicateurs
SET resume = replace(resume, E'\\u2014', E'\\u2013')
WHERE resume IS NOT NULL AND resume LIKE '%' || E'\\u2014' || '%';
