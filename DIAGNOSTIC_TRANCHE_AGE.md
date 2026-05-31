# Diagnostic — complétude tranche d'âge

Date : 30 mai 2026

## 1. Constats sur le fichier source `Base de sondage_EmploiJeune_Global_230426_V2 (2).xlsm`

| Métrique | Valeur |
|---|---|
| Total bénéficiaires (lignes avec sexe non vide) | 5 512 |
| Tranche `'18-34 ans'` | 3 354 (60,8%) |
| Tranche `'35 ans et +'` | 2 075 (37,6%) |
| Tranche **vide** | 83 (**1,5%**) |

**Le gap dans le fichier source est très faible : 1,5%.**

## 2. Répartition du gap par projet

| Projet | Manquants | Total | % |
|---|---|---|---|
| P6   | 1  | 50    | 2,0% |
| P14  | 78 | 4 626 | 1,7% |
| P16a | 3  | 253   | 1,2% |
| P19  | 1  | 422   | 0,2% |
| P18  | 0  | 104   | 0,0% |
| P13  | 0  | 57    | 0,0% |

Le projet **P14** concentre 94% des manquants en valeur absolue (78 lignes sur 83) mais reste à seulement 1,7% de gap interne.

## 3. Répartition du gap par pays

| Pays | Manquants | Total | % |
|---|---|---|---|
| **`∅ VIDE` (pays non renseigné)** | 50 | 132 | **37,9%** |
| Maurice    | 1 | 36  | 2,8% |
| Congo RD   | 3 | 115 | 2,6% |
| Liban      | 5 | 238 | 2,1% |
| Sénégal    | 4 | 206 | 1,9% |
| Bénin      | 8 | 592 | 1,4% |

**Anomalie détectée** : 132 bénéficiaires sans pays renseigné, dont 50 sans tranche d'âge non plus. À traiter en priorité.

**Doublon de nomenclature** : `Côte d'Ivoire` (apostrophe droite) et `Côte d'Ivoire` (apostrophe courbe) sont stockés comme deux pays distincts (217 vs 39 lignes).

## 4. Pourquoi tu perçois un "énorme gap" en production

Le fichier source est propre. La perception d'un gap énorme côté plateforme vient probablement d'un de ces 3 facteurs :

**Hypothèse A — Imports partiels** : la limite de 5 000 lignes (corrigée à 50 000) a forcé le découpage du fichier. Si certains lots ont été importés sans la colonne « Tranche d'âge » correctement mappée, la base contient des lignes vides.

**Hypothèse B — Importations précédentes** : des fichiers antérieurs ne contenaient peut-être pas la colonne tranche d'âge, ou avec une nomenclature non reconnue par `normaliserTrancheAge` (`lib/imports/smart-mapper.ts:560`). Les alias actuellement reconnus :
`jeune`, `j`, `18-34`, `18-34 ans`, `jeune (18-34 ans)`, `adulte`, `a`, `35+`, `35 ans et +`, `35 et +`, `adulte (35 ans et +)`.

**Hypothèse C — Colonne mal détectée** : si l'en-tête du fichier était sur une autre ligne que la 5 (où elle se trouve réellement), le smart-mapper a pu manquer la colonne. Le parser flexible essaie 15 lignes (`HORIZON_LIGNE_ENTETE = 15`) — devrait fonctionner ici.

## 5. Requête SQL à exécuter sur Supabase pour quantifier le gap en base

À coller dans le SQL Editor du projet `gflragycnsaeqppgnfna` :

```sql
-- Complétude tranche d'âge en base, globale + par projet + par pays
WITH stats_globales AS (
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL) AS avec_tranche,
    ROUND(100.0 * COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS pct_complete
  FROM public.beneficiaires
  WHERE deleted_at IS NULL
)
SELECT 'GLOBAL' AS niveau, NULL AS clef, total, avec_tranche, pct_complete
FROM stats_globales
UNION ALL
SELECT 'PROJET', projet_code, COUNT(*),
       COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL),
       ROUND(100.0 * COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM public.beneficiaires
WHERE deleted_at IS NULL
GROUP BY projet_code
UNION ALL
SELECT 'PAYS', pays_code, COUNT(*),
       COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL),
       ROUND(100.0 * COUNT(*) FILTER (WHERE tranche_age_declaree IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM public.beneficiaires
WHERE deleted_at IS NULL
GROUP BY pays_code
ORDER BY niveau, pct_complete NULLS FIRST;
```

## 6. Plan d'action recommandé selon le résultat

| Résultat de la requête | Action |
|---|---|
| Complétude globale ≥ 95% | Pas de chantier critique. Nettoyer les 50 pays vides et le doublon Côte d'Ivoire. |
| Complétude 70-95% | Identifier les projets/pays défaillants. Réimporter les fichiers source avec la limite 50 000. |
| Complétude < 70% | Bug d'import probable. Vérifier `smart-mapper.ts` + faire un import test en debug. |

## 7. Améliorations possibles côté code

1. **Ajouter alias de tranche d'âge** si la requête révèle d'autres formats utilisés : éditer `TRANCHE_AGE_ALIASES` dans `lib/imports/smart-mapper.ts:412`.
2. **Normaliser Côte d'Ivoire** : dans `smart-mapper.ts`, forcer une seule apostrophe lors de la résolution pays.
3. **Bloquant `pays_code` à l'import** : actuellement nullable (`20260514100001_pays_code_nullable_beneficiaires.sql`). Si le pays est critique pour l'analyse, on peut le rendre obligatoire avec un rapport d'erreur clair par ligne.
4. **Dashboard de qualité des données** : ajouter une carte "Complétude tranche d'âge" dans `/admin/alertes-qualite` qui affiche le % en temps réel.
