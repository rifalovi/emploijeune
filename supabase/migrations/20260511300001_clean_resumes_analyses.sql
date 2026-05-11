-- =============================================================================
-- Migration — Nettoyage des analyses_indicateurs générées avant correctifs
-- -----------------------------------------------------------------------------
-- Deux nettoyages one-shot pour les analyses déjà en base AVANT que :
--   • le pipeline d'extraction du résumé ait été corrigé (commit 12ecab2 :
--     exclure les lignes commençant par '#' AVANT le filtre de longueur)
--   • le prompt Claude ait reçu l'instruction "N'utilise PAS de lignes
--     horizontales (---)" (commit e43c7eb)
--
-- Effet sur la vitrine /realisations/[pilier]/[indicateur] :
--   • supprime le double titre (accroche = "Signification et importance"
--     + H3 colorée du même libellé juste en dessous)
--   • supprime les traits `---` qui s'affichaient en texte brut entre les
--     sections
--
-- Les nouvelles analyses générées après les correctifs ne sont pas
-- touchées : le filtre `length(resume) < 60` est conservateur (un vrai
-- résumé fait toujours > 60 char), et le regex_replace est idempotent.
-- =============================================================================

-- 1. Résumés qui sont en fait des titres de section
UPDATE public.analyses_indicateurs
SET resume = NULL
WHERE resume IS NOT NULL
  AND (
    length(resume) < 60
    OR resume ~* '^(Signification|Interprétation|Lecture|Facteurs|Recommandations|Analyse de l''indicateur)'
  );

-- 2. Séparateurs --- générés par Claude avant la consigne du prompt
UPDATE public.analyses_indicateurs
SET contenu = regexp_replace(contenu, E'\\n?---+\\n?', E'\\n', 'g')
WHERE contenu LIKE '%---%';
