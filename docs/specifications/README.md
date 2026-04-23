# Spécifications OIF — documents de référence

> Archive des documents officiels OIF servant de source de vérité pour la conception, la volumétrie et la validation des formulaires d'enquête.
>
> **Principe général** : toute décision métier ou ergonomique qui concerne les données A1/B1 ou les enquêtes A2-F1 doit pouvoir se justifier par un renvoi à l'un de ces documents.

## Base de sondage (source de vérité volumétrique)

- **Fichier** : [`Base de sondage_EmploiJeune_Global_230426_V2.xlsm`](Base%20de%20sondage_EmploiJeune_Global_230426_V2.xlsm)
- **Mise à jour** : 23 avril 2026
- **Bénéficiaires (feuille 1)** : **5 623 lignes, 14 colonnes**
- **Structures (feuille 2)** : **347 lignes, 13 colonnes**
- Structure compatible avec le [Template OIF Emploi Jeunes V1](../references/Template_OIF_Emploi_Jeunes_V1%20(1).xlsx).

Usage plateforme :
- Base de référence pour l'import Excel de l'Étape 7 — ces ~6 000 lignes représentent le fonds historique à réintégrer.
- Valeurs attendues pour les tests de charge (liste paginée, recherche, export).

## Questionnaires officiels (Étape 6 à venir)

### Questionnaire A — Indicateurs bénéficiaires

- **Fichier** : [`questionnaires/Questionnaire EmploiJeunes_ Indicateurs A_V2.docx`](questionnaires/Questionnaire%20EmploiJeunes_%20Indicateurs%20A_V2.docx)
- **Cible** : jeunes formés via un projet OIF.
- **Couvre** : A2 (taux d'achèvement), A3 (certification), A4 (gain de compétences), A5 (insertion professionnelle), F1 partiellement (usage du français).
- **Structure** : 35 questions réparties en 4 sections (Infos, Participation, Compétences, Insertion), avec filtres conditionnels « ALLER À » pour sauter les questions non pertinentes selon les réponses précédentes.

### Questionnaire B — Indicateurs structures

- **Fichier** : [`questionnaires/Questionnaire EmploiJeunes_ Indicateurs B_V2.docx`](questionnaires/Questionnaire%20EmploiJeunes_%20Indicateurs%20B_V2.docx)
- **Cible** : organisations économiques appuyées par l'OIF.
- **Couvre** : B2 (survie), B3 (emplois créés/maintenus), B4 (emplois indirects).
- **Structure** : 22 questions en 3 sections, filtres conditionnels idem Questionnaire A.

## Plan d'exploitation

### Étape 4 (en cours) — CRUD bénéficiaires A1

La tranche d'âge affichée dans la liste et sur la fiche détail utilise les bornes du **Questionnaire A, question 105** : 18-34 / 35-60 / +60 ans (+ Mineur et Non renseigné pour les cas plateforme). Garantit la cohérence visuelle avec les réponses d'enquêtes A5 à venir. Voir [`components/beneficiaires/tranche-age.ts`](../../components/beneficiaires/tranche-age.ts).

### Étape 6 — Formulaires d'enquête

- Conception des formulaires React à partir des 35 (A) + 22 (B) questions des questionnaires officiels.
- Stockage structuré : une ligne par réponse dans `public.reponses_enquetes`, données brutes en colonne `donnees JSONB` validée par schémas Zod dédiés (un schéma par indicateur A2, A3, A4, A5, B2, B3, B4).
- Reproduction fidèle de la logique de filtres « ALLER À » (jumps conditionnels entre questions).
- Module transversal F1 (langue française) à greffer sur les questionnaires A4, A5 et C5 selon les modalités décrites dans la Note méthodologique V2.

## Historique

| Date | Changement |
|------|------------|
| 2026-04-24 | Création du README. Archivage des 3 documents V2 (base de sondage, questionnaires A et B). |
