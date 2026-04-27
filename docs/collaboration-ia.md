# Protocole de collaboration IA — Plateforme OIF Emploi Jeunes

> Document de référence pour la collaboration entre le chef de
> projet (Carlos HOUNSINOU), l'IA de supervision (Claude.ai)
> et l'IA d'exécution (Claude Code).
>
> Version : 1.0 — Après clôture Étape 4 (24 avril 2026)

## 🎯 Philosophie de collaboration

Trois rôles clairement distincts :

**Chef de projet (Carlos)** — Propriétaire produit, arbitre
stratégique, testeur visuel final. Décisionnaire sur les
questions métier, RGPD, et priorisation.

**Claude.ai (supervision IA)** — Architecte, analyste, pré-
décideur. Prépare les cadrages, les messages, analyse les
rapports, propose des arbitrages par défaut.

**Claude Code (exécution IA)** — Développeur. Écrit le code,
les tests, les migrations SQL. Livre des commits atomiques
avec rapports détaillés.

**Règle d'or** : Carlos ne tranche que les décisions
stratégiques. L'opérationnel est délégué.

## 📋 Règles d'exécution pour Claude Code

### Qualité code (non négociable)

- Un seul commit atomique par sous-étape
- Titre de commit descriptif et factuel
- Tests unitaires pour chaque composant pur et logique métier
- Tests d'intégration pour les Server Actions critiques
- `typecheck` + `lint` + `build` + `tests` doivent être verts
  avant commit
- Pas de `any` sans commentaire justificatif
- Pas de console.log résiduel en production

### Workflow atomique

1. Livrer le code de la sous-étape
2. Rapporter avec métriques (hash, fichiers, tests, difficultés)
3. **STOP obligatoire** — attendre validation avant sous-étape
   suivante
4. Push sur `origin/main` à chaque commit validé

### Pattern de rapport attendu

Chaque rapport de fin de sous-étape doit suivre cette
structure pour faciliter la validation rapide par Carlos et
Claude.ai :

**Section 1 — Commit**

- Hash court du commit (ex: abc1234)
- Titre exact du commit
- Confirmation du push vers origin/main

**Section 2 — Vérifications qualité**

Tableau avec 4 lignes minimum :

- `npm run typecheck` → ✅ ou ❌
- `npm run lint` → ✅ avec nombre de warnings/errors
- `npm run test` → ✅ avec nombre total de tests passants
- `npm run build` → ✅ ou ❌ avec taille First Load si pertinent

**Section 3 — Fichiers créés / modifiés**

Liste avec pour chaque fichier :

- Chemin relatif depuis la racine
- Type : nouveau / modifié
- Rôle ou changement en 1 ligne

**Section 4 — Tests ajoutés**

- Nom du fichier de test
- Nombre de tests ajoutés
- Description courte des cas couverts

**Section 5 — Rendu visuel attendu**

Description textuelle de ce que l'utilisateur doit voir
(cards, filtres, boutons, interactions) si Claude Code ne
peut pas produire de capture d'écran.

**Section 6 — Difficultés techniques rencontrées**

Pour chaque difficulté :

- Symptôme observé
- Cause racine identifiée
- Solution appliquée

**Section 7 — Questions éventuelles pour la suite**

Maximum 3-5 questions. Pour chacune :

- Contexte
- Options envisageables
- Ta recommandation par défaut

**Section 8 — STOP explicite**

Ligne finale :

> ⏸ STOP X — J'attends ton OK pour passer à Y

Ce pattern garantit que Carlos et Claude.ai peuvent valider
en 2 minutes sans avoir à demander des précisions.

## 🎯 Arbitrages par défaut (ne plus rediscuter)

Ces décisions ont été validées dans l'Étape 4 et s'appliquent
à toutes les étapes suivantes sauf contre-indication explicite.

### Architecture & sécurité

- **Authentification** : Magic link Supabase (décision 24 avril
  2026, révision post-pilote si nécessaire)
- **Sécurité** : RLS Supabase avec 4 rôles (admin_scs,
  chef_projet, contributeur_partenaire, observateur)
- **Soft-delete** : `deleted_at` + `deleted_by` + `deleted_reason`
  sur toutes les tables métier
- **Audit** : `public.journaux_audit` alimenté automatiquement par
  les triggers `tg_audit_row()` à chaque INSERT / UPDATE / DELETE
  sur les tables sensibles. **Convention exacte des colonnes**
  (à respecter pour tout SELECT / INSERT vers cette table) :

  ```sql
  -- Table : public.journaux_audit
  --   id              BIGSERIAL  PRIMARY KEY
  --   table_affectee  TEXT       NOT NULL
  --   ligne_id        UUID       (NULL pour les actions VIEW_AS_*)
  --   action          public.action_audit  NOT NULL  -- ENUM, PAS « action_type »
  --   diff            JSONB      NOT NULL
  --   user_id         UUID       (auteur de l'action)
  --   user_email      TEXT       (snapshot)
  --   horodatage      TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- PAS « created_at »
  ```

  Valeurs ENUM `action_audit` : `INSERT`, `UPDATE`, `DELETE`,
  `SOFT_DELETE`, `RESTORE`, `VIEW_AS_START`, `VIEW_AS_END`
  (cf. migrations 001 + 016).

  ⚠️ Pièges récurrents (cf. hotfix v1.2.6) :
  - Ne jamais utiliser `created_at` pour cette table — la colonne
    s'appelle `horodatage`.
  - Ne jamais utiliser `action_type` — la colonne s'appelle `action`.
  - Pour les inserts manuels (Server Actions), laisser le DEFAULT
    NOW() sur `horodatage` plutôt que de le préciser.

### UX & design

- **Design system** : charte graphique OIF (voir `lib/design/oif/`)
- **Typographie** : Inter (fallback Helvetica Neue)
- **Icônes** : lucide-react exclusivement
- **Composants UI** : shadcn/ui + Base-UI (compat 1.3+ avec
  `modal={false}` sur les Select)
- **Couleurs PS** : bordure gauche colorée selon le Programme
  Stratégique du projet
- **Toasts** : Sonner, position bottom-right, auto-dismiss 3s

### Patterns formulaires

- **Validation** : Zod + React Hook Form via `Controller`
- **Règles métier** : centralisées dans `appliquerReglesMetier(data, ctx)`
- **Dropdowns** : `SelectValue` avec children function pour les
  libellés humains (pas les valeurs brutes)
- **Libellés longs** : `truncate` + `title` attribut pour
  tooltip natif
- **Saisie à la chaîne** : pré-remplissage via URL params pour
  les formulaires de création (ex: `?cohorte_projet=...`)
- **Détection doublon** : bloquante avec message actionnable
  et lien vers la fiche existante
- **Cross-field validation RGPD** : strict

### Listes & filtres

- **Recherche textuelle** : similarity pg_trgm (tolérance aux
  typos)
- **Pagination** : offset + limit, taille par défaut 25,
  options 10/25/50/100
- **Filtres** : dropdowns séparés de la recherche, combinables
- **URL sync** : tous les filtres persistés dans les query
  params (partageabilité)
- **Clic ligne** : ouvre la fiche détail
- **Menu ⋯** : 2 actions max (Modifier + Supprimer admin_scs)

### Export Excel

- **Format** : strictement aligné Template OIF V1
- **Librairie** : ExcelJS
- **Feuille Metadata** : obligatoire (date, utilisateur,
  filtres, version)
- **Nom fichier** : `OIF_[Ressource]_[ProjetSiUnique]_AAAAMMJJ_HHmm.xlsx`

### Tests

- **Unitaires** : schémas Zod, utils purs, composants purs
- **Intégration** : Server Actions critiques (CREATE, UPDATE,
  DELETE)
- **E2E** : Playwright pour les parcours utilisateur clés
  (ticket V1.5 si pas encore en place)

## 🎯 Autonomie Claude Code — Ce qu'il tranche seul

Claude Code **ne demande PAS** Carlos pour :

- Choix technique implémentation (cache React.cache, helpers
  extraits, structure des fichiers)
- Nommage de variables, fonctions, fichiers (suit les conventions)
- Gestion d'erreurs de mise à jour de librairies (ex: Base-UI
  1.3+ breaking change → applique le fix et documente)
- Optimisations mineures (plafonds de requête, indexes)
- Ajout de tests de non-régression
- Refactoring mineur pour DRY

Claude Code **demande** Carlos pour :

- Nouvelles règles métier non documentées
- Arbitrages UX non triviaux
- Contraintes RGPD ou juridiques inédites
- Impact sur la roadmap (nouvelle étape, changement d'ordre)
- Coûts financiers (nouvelles licences, upgrades)

## 🎯 Protocole de validation Carlos → Claude Code

**Format des messages de validation (Carlos)** :

- **"OK, poursuis"** → validation sans remarque, passe à la suite
- **"OK + [précision]"** → validation avec une note à retenir
- **"Correction : [détail]"** → refus, correction demandée
- **"Question : [détail]"** → demande de clarification avant suite

**Format des messages de cadrage (Claude.ai pour Carlos)** :

Claude.ai pré-rédige systématiquement les messages pour Claude
Code. Carlos valide en 1 mot ou modifie ponctuellement.

Exemple de message type Claude.ai → Carlos :

> **Message prêt pour Claude Code** (copiez-collez tel quel) :
> [bloc message complet]
>
> **Arbitrages pris** : X, Y, Z (conformes Étape 4)
> **Arbitrages nouveaux** : rien / [précisions]
>
> Validez-vous ?

## 🔄 Gestion des hotfixes

Si un bug est découvert en test visuel :

1. Carlos reporte avec captures et description précise
2. Claude.ai analyse et pré-rédige le message de diagnostic
   pour Claude Code
3. Claude Code applique le pattern "diagnostic avant fix" :
   - Inspection du code avant modification
   - Hypothèse précise de cause racine
   - Rapport d'inspection avant de coder le fix
   - Fix ciblé sur la cause identifiée
4. Test visuel par Carlos
5. Itération si besoin

**Règle absolue** : pas de fix aveugle. Un diagnostic précis
avant chaque modification.

## 🐘 Pièges PostgreSQL connus (à vérifier dans toute fonction SQL)

Liste des patterns qui ont déjà cassé une migration et doivent
être bannis ou explicitement castés. Mise à jour à chaque
hotfix lié à une fonction SQL.

### MIN/MAX sur UUID — interdit

PostgreSQL ne fournit PAS d'agrégats `min(uuid)` / `max(uuid)`
nativement (`ERROR: function min(uuid) does not exist`). Trois
parades selon l'intention :

- **Récupérer une valeur représentative** quand toutes les
  lignes du groupe partagent le même UUID (cas typique :
  agrégation par session) → `MIN(col::text)::uuid`.
- **Tester la présence d'au moins une ligne non-NULL** →
  `BOOL_OR(col IS NOT NULL)`.
- **Sélectionner une ligne entière représentative** →
  `DISTINCT ON (group_key) ... ORDER BY group_key, col`.

Le test [`tests/unit/migrations-smoke.spec.ts`](../tests/unit/migrations-smoke.spec.ts)
scanne toutes les migrations pour détecter ce pattern et fait
échouer le build s'il en trouve. Cf. hotfix 6h (26/04/2026).

### Smoke tests obligatoires sur fonctions SQL

À partir de l'Étape 7, toute nouvelle fonction Postgres doit
être accompagnée d'au moins un test (unitaire ou regex sur le
fichier migration) qui valide :

- Pas de MIN/MAX sur des types non-supportés (UUID, JSON,
  POINT, etc.).
- Présence des arguments attendus dans la signature.
- Présence des CAST explicites pour les enums et UUID.

Ces tests ne remplacent pas une vraie exécution Postgres mais
attrapent les bugs « qui auraient pu être évités par grep »
avant que Carlos ne tombe dessus en `supabase db push`.

## 📊 Historique des jalons

| Jalon | Date       | Description                                 |
| ----- | ---------- | ------------------------------------------- |
| v0.1  | —          | Structure Next.js + Supabase                |
| v0.2  | —          | Modèle de données + RLS                     |
| v0.3  | —          | Auth + Dashboard admin                      |
| v0.4  | 24/04/2026 | CRUD bénéficiaires A1 complet               |
| v0.5  | à venir    | CRUD structures B1                          |
| v0.6  | à venir    | Enquêtes A/B/C/F                            |
| v0.7  | à venir    | Imports Excel                               |
| v0.8  | à venir    | Admin UI avancée                            |
| v0.9  | à venir    | Dashboards analytics                        |
| v1.0  | cible juin 2026 | V1 production (pilote 60 partenaires)   |

## 🛠️ Outils et environnement

- **Repo** : github.com/rifalovi/emploijeune
- **Hosting** : local (dev) → Supabase Free → Supabase Pro
- **Email** : Supabase SMTP → Resend (carloshounsinou.com) →
  Resend avec domaine OIF officiel
- **Déploiement web** : à définir (Vercel staging puis infra OIF)

## 📝 Référence documents

- Charte graphique OIF : `docs/branding/sources/`
- Questionnaires officiels : `docs/specifications/questionnaires/`
- Base de sondage V2 : `docs/specifications/`
- Cadrages par étape : `docs/etapes/`
- Backlog V1.5 : `docs/backlog.md`
