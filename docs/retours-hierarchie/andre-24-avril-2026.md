# Retour N+1 (André) — 24 avril 2026

## Philosophie générale

« L'objectif ne doit pas être de faire une refonte mais de
compléter ou créer un Dashboard qui absorbe les indicateurs
et nouvelles fonctionnalités demandées, y compris les
spécifications qui sont demandées. Le travail effectué
jusque-là est solide et suffisamment abouti. Donc on le
garde et on le capitalise. »

Implication directe : la roadmap existante (Étapes 4-9) répond
aux besoins. Aucune refonte nécessaire.

## Demandes explicites d'André

### Demande 1 — Architecture et base de données (back-end)

**État actuel** : ✅ Déjà conforme

- Base de données dynamique (Supabase liée à l'app, actualisation
  automatique) ✓
- Sécurité : RLS par rôle, données brutes en back-office, accès
  admin uniquement ✓
- Extractions ponctuelles par admins : Export Excel Étape 4e ✓

**Aucune action supplémentaire requise**.

### Demande 2 — Maquette blanche (front-end)

**État actuel** : ⚠️ À produire après Étape 9

« Une maquette blanche doit être préparée dans un premier
temps, prête à être connectée aux bases de données lors du
lancement de l'enquête. »

**Décision stratégique** : la maquette sera extraite du produit
réel APRÈS la livraison de l'Étape 9 (Dashboards analytics).
Mode "démo" avec données fictives plausibles. Fidélité 100%
garantie.

**Justification** : éviter le double travail, garantir la
fidélité, respecter la stratégie d'anticipation du chef de
projet.

### Demande 3 — Indicateurs publics agrégés

**État actuel** : 🔜 Planifiés dans la roadmap

Indicateurs à afficher dans l'interface publique épurée :

| Indicateur                                 | Source | Étape        |
| ------------------------------------------ | ------ | ------------ |
| Nombre de jeunes formés (+ catégorisation) | A1     | ✅ Étape 4    |
| Taux d'achèvement des formations           | A2     | 🔜 Étape 6   |
| Taux de certification                      | A3     | 🔜 Étape 6   |
| Taux de satisfaction                       | C      | 🔜 Étape 6   |
| Autres indicateurs A, B, F                 | A, B, F | 🔜 Étapes 4-6 |

Agrégation et affichage : Étape 9.

### Demande 4 — Marqueurs transversaux (Architecture du Cadre Commun)

**État actuel** : 🔜 À intégrer dans la conception Étape 9

Le dashboard public devra présenter esthétiquement
l'Architecture du Cadre Commun OIF.

**4 piliers thématiques** :

1. **Formation et Compétences**
   → Développer les compétences et connaissances pour l'emploi
   → Indicateurs A (achèvement, certification, gain compétences,
     insertion)

2. **Activités Économiques**
   → Encourager l'entrepreneuriat et la création d'emplois
   → Indicateurs B (survie activités, emplois créés/maintenus,
     emplois indirects)

3. **Intermédiation**
   → Faciliter l'accès aux opportunités d'emploi
   → Partie des indicateurs F

4. **Écosystèmes d'Emploi**
   → Créer un environnement favorable à la croissance de
     l'emploi
   → Indicateurs C (effets systémiques)

**Marqueur transversal** :

5. **Langue française (F1)**
   → « Améliorer l'employabilité grâce à la maîtrise du français »
   → Composant visuel qui traverse les 4 piliers
   → Indicateur F1 (usage du français dans le parcours pro)

## Logique de collecte des données

- Méthodologie : recensement volontaire (pas sondage raisonné)
- Cibles : tous les contacts disposant d'une adresse
- Source : formulaires renseignés par les partenaires/signataires

## Décisions du chef de projet

1. **Pas de refonte** : roadmap actuelle (Étapes 4-9) couvre 100 %
   des demandes d'André. On poursuit.
2. **Maquette blanche après Étape 9** : extraite du produit réel
   en mode démo. Pas de développement parallèle.
3. **Architecture Cadre Commun comme trame visuelle de l'Étape 9** :
   le dashboard public utilisera les 4 piliers + marqueur
   transversal comme structure principale.
4. **Priorité stratégique** : continuer le développement dans
   l'ordre prévu (5 → 6 → 7 → 8 → 9).

## Traçabilité

- Retour reçu : 24 avril 2026
- Documenté dans ce fichier + backlog
- À re-consulter au démarrage de l'Étape 9
