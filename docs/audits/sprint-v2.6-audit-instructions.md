═══════════════════════════════════════════════════════════════
SPRINT V2.6 — AUDIT COMPLET DE LA PLATEFORME
OIF Emploi Jeunes — PRÉ-PILOTE 15 JUIN 2026
═══════════════════════════════════════════════════════════════

CONTEXTE :
La plateforme OIF Emploi Jeunes est en production sur
suivi-projet.org. Elle a atteint la maturité v2.5.x avec
51 migrations Supabase, 47 pages Next.js, 5 rôles
hiérarchiques, 2 pipelines d'import IA (A1 bénéficiaires
et B1 structures), un assistant IA analytique, un chatbot
public SCS, un système d'enquêtes terrain, une application
mobile Capacitor (iOS/Android) en mode remote-server, et
18 indicateurs CMR avec saisies manuelles et analyses IA.

Avant le pilote du 15 juin 2026 avec 60 partenaires, il
faut un audit complet senior pour identifier :
  - Dettes techniques accumulées
  - Failles de sécurité potentielles
  - Régressions silencieuses
  - Optimisations critiques
  - Cohérence métier OIF
  - Préparation production

STACK TECHNIQUE :
  - Next.js 14 App Router (Server Actions + Route Handlers)
  - Supabase (PostgreSQL + RLS + Auth + Edge Functions)
  - TypeScript strict
  - Tailwind CSS + shadcn/ui + Radix UI
  - Vitest (tests unitaires, ~38 fichiers spec)
  - Playwright (tests E2E)
  - Anthropic SDK (@anthropic-ai/sdk ^0.95.1)
    · Claude Haiku 4.5 — imports IA (extraction PDF/DOCX/TXT)
    · Claude Sonnet — assistant IA analytique
    · Claude — chatbot SCS public
  - Capacitor V2.3.0 — wrapper iOS/Android (mode remote-server)
  - Vercel — hébergement production
  - Supabase Frankfurt (EU) — BDD et Auth

RÔLES (5 niveaux hiérarchiques) :
  super_admin > admin_scs > editeur_projet >
  contributeur_partenaire > lecteur

OBJECTIF :
Livrer un RAPPORT D'AUDIT structuré identifiant tous les
points de vigilance, classés par criticité, avec
recommandations actionables.

PAS DE CORRECTION dans ce sprint — uniquement DIAGNOSTIC
et PRIORISATION. Les fixes seront ensuite traités en
sprints dédiés selon la priorité.

═══════════════════════════════════════════════════════════════
PÉRIMÈTRE DE L'AUDIT — 10 AXES
═══════════════════════════════════════════════════════════════

AXE 1 — SÉCURITÉ
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Authentification
   - Tous les flows auth fonctionnent (login, magic link,
     reset password)
   - Tokens Supabase stockés en cookies httpOnly + secure +
     sameSite strict
   - Refresh tokens correctement gérés par le middleware
   - Session timeout cohérent
   - Pas de credentials hardcodés dans le code source
   - Vérifier que `requireUtilisateurValide()` est appelé en
     tête de TOUTES les pages et server actions protégées

B. Autorisation (RLS)
   - Toutes les tables sensibles ont RLS activé : beneficiaires,
     structures, utilisateurs, imports_excel, journaux_audit,
     analyses_indicateurs, valeurs_indicateurs_saisies,
     affectation_projet_courante, affectation_projet_historique,
     structure_projet_historique, campagnes, sessions_enquete,
     reponses_enquete
   - Politiques RLS couvrent SELECT, INSERT, UPDATE, DELETE
   - Pas de bypass via service_role dans les Server Actions
     en dehors des opérations légitimes (imports, admin)
   - Hiérarchie 5 rôles respectée partout
   - Un editeur_projet ne doit JAMAIS accéder aux données
     d'un autre projet (isolement par projet_code)
   - Les analyses IA (analyses_indicateurs) sont bien
     restreintes au super_admin

C. Validation des entrées
   - Schémas Zod sur TOUTES les server actions (~50 actions)
   - Vérifier smart-mapper.ts : pas d'injection possible via
     valeurs brutes non sanitizées
   - Protection XSS : pas de dangerouslySetInnerHTML abusif
   - Limites de taille sur uploads (5 MB Excel, 10 MB IA)
   - Vérifier les champs libres : commentaire, adresse,
     intitule_initiative — longueur max définie ?
   - Enquêtes : les réponses publiques (token) sont-elles
     correctement validées avant insertion ?

D. Secrets et variables d'environnement
   - .env.local présent dans .gitignore (✓ confirmé)
   - Pas de clés API dans le code source
   - ANTHROPIC_API_KEY uniquement côté serveur
     (ia-extractor.ts, ia-extractor-structures.ts,
      server-actions.ts, analyses-indicateurs, chatbot-scs)
   - SUPABASE_SERVICE_ROLE_KEY uniquement en runtime server
     (createSupabaseAdminClient) — jamais exposée client
   - Vérifier que la clé Anthropic n'est pas loggée en cas
     d'erreur
   - Rotation des secrets possible sans casser la prod

E. Rate limiting & DoS
   - Chatbot SCS : rate limit 30 req/h par IP en mémoire
     (Map JS) → CRITIQUE : pas de persistance cross-restart,
     pas de Redis. Vérifier si un cold start Vercel reset le
     compteur
   - Assistant IA : pas de rate limit IP visible — vérifier
   - Import IA : pas de rate limit explicite côté route.ts —
     vérifier si le feature flag seul suffit
   - Imports Excel : vérifier limite sur le nombre d'appels
     simultanés

F. RGPD
   - Anonymisation IA effective : `anonymiserTexte()` appliqué
     à TOUS les messages utilisateur avant envoi à Claude
     (regex: email, téléphone, UUID, noms/prénoms)
   - Vérifier les cas limites : que se passe-t-il si un
     utilisateur colle un dump CSV dans le chat ?
   - Consentement bénéficiaires tracé (consentement_recueilli)
   - Import IA B1 : les structures insérées avec consentement
     = false par défaut — procédure de mise à jour documentée ?
   - Droit à l'oubli : cascade delete propre sur beneficiaires
     et structures
   - Chatbot SCS : pas de persistance BDD (✓ localStorage
     uniquement) — vérifier qu'aucun log serveur ne capture
     les messages
   - Hébergement EU (Supabase Frankfurt confirmé)

G. Audit log
   - journaux_audit capture TOUTES les actions sensibles :
     imports, modifications bénéficiaires/structures,
     affectations projet, changements de rôle, analyses IA
   - Diff JSONB lisible et exploitable
   - Pas de fuite de données nominatives dans les logs
   - Rétention adéquate (90 jours min)

LIVRABLE : Liste des vulnérabilités classées CRITIQUE /
HAUTE / MOYENNE / FAIBLE.

═══════════════════════════════════════════════════════════════
AXE 2 — INTÉGRITÉ DES DONNÉES
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Cohérence BDD
   - 51 migrations : vérifier que toutes sont appliquées et
     dans l'ordre correct en production
   - Contraintes FOREIGN KEY sur toutes les jointures métier
   - CHECK constraint projets.code ~ '^PROJ_A[0-9]{1,2}[a-z]?$'
     appliquée (migration 20260512500001)
   - Index sur les colonnes fréquemment requêtées :
     beneficiaires(projet_code), structures(projet_code),
     affectation_projet_courante(user_id, projet_code)
   - Triggers fonctionnels : updated_at automatique sur toutes
     les tables modifiables
   - Pas de données orphelines (FK cassées après purge projets)

B. Données réelles
   - Vérifier les comptages : dashboard vs pages de liste
     (bénéficiaires, structures)
   - Cohérence entre indicateurs_annuels calculés et saisies
     manuelles (valeurs_indicateurs_saisies)
   - Vérifier que les 23 codes projets officiels sont présents
     (PROJ_A01a → PROJ_A20) et que la purge a bien éliminé
     les entrées non officielles
   - Pas de doublons silencieux sur beneficiaires
     (index unique à vérifier sur prenom+nom+pays+projet ou
      équivalent)

C. Imports
   - Pipeline import Excel A1 (import-beneficiaires.ts) :
     idempotent ? Re-jouer le même fichier = doublons détectés
     ou insérés en double ?
   - Pipeline import Excel B1 (import-structures.ts) :
     même question
   - Pipelines IA A1 et B1 : source_import = 'ia_v1' vs
     'excel_v1' — les doublons entre les deux sources sont-ils
     détectés ?
   - Rollback import (20260512100001) : tester le rollback
     effectif depuis l'UI admin
   - Logs d'import accessibles super_admin (/admin/imports)
   - Mapping Excel toujours valide avec les 37 colonnes B1
     et les colonnes A1

D. Sauvegardes
   - Backups Supabase automatiques actifs (projet prod)
   - Procédure de restauration documentée et testée
   - Export CSV/Excel complet disponible pour chaque entité
     (bénéficiaires, structures, enquêtes — routes /api/export)

E. Validation métier
   - Tranche d'âge : Jeune (18-34 ans) / Adulte (35+)
     harmonisée après migration 20260511000001 — vérifier
     cohérence sur toutes les pages (enquêtes, import, affichage)
   - Codes pays normalisés ISO-3 (61 valeurs dans nomenclatures.ts)
   - Devises cohérentes (EUR par défaut, 15 devises supportées)
   - Dates dans plages réalistes
   - Consentement_recueilli false sur imports IA B1 : alertes
     visibles dans le rapport enrichi ? Procédure de complétion ?

LIVRABLE : Rapport de cohérence avec écarts identifiés.

═══════════════════════════════════════════════════════════════
AXE 3 — PERFORMANCE
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Pages à auditer (47 pages total) — focus sur les 12 clés :
    1. / (accueil vitrine)
    2. /referentiels
    3. /referentiels/[code] (ex: /referentiels/CMR)
    4. /realisations
    5. /connexion
    6. /dashboard
    7. /beneficiaires
    8. /structures
    9. /indicateurs
   10. /indicateurs/[code]
   11. /assistant-ia
   12. /super-admin

   Cibles Lighthouse :
   - Performance > 90
   - Accessibilité > 95
   - Best practices > 90

B. Temps de réponse API
   - Server actions CRUD < 500ms (P95)
   - Chatbot SCS (/api/chatbot-scs) < 2s première réponse
     (streaming), < 8s réponse complète
   - Assistant IA (/assistant-ia server actions) < 5s
   - Import Excel 1000 lignes < 15s
   - Import IA (extraction + Claude Haiku) < 30s par timeout
   - Export Excel bénéficiaires < 10s

C. Requêtes SQL
   - Identifier les requêtes lentes avec EXPLAIN ANALYZE :
     · lister_indicateurs_avec_valeurs_annuelles (RPC)
     · Comptages dashboard (kpis)
     · Listage bénéficiaires avec filtres multiples
     · Historique affectations projet
   - N+1 queries : vérifier les pages liste avec joins
     (getHistoriqueProjet hydrate les noms en 2 requêtes — OK
     si batché, problème si boucle)
   - Index sur projet_code, pays_code partout où filtrage fréquent

D. Bundle size
   - First Load JS < 300 KB par route
   - Vérifier les dépendances lourdes :
     · @anthropic-ai/sdk — uniquement serveur ?
     · mammoth (DOCX parsing) — uniquement serveur ?
     · unpdf — uniquement serveur ?
     · ExcelJS — uniquement serveur ?
   - Capacitor SDK : @capacitor/* — importé côté client ?
   - Code splitting effectif (dynamic imports pour modales, etc.)

E. Cache et ISR
   - Pages publiques (accueil, réalisations, référentiels) :
     revalidation ISR configurée ?
   - `export const dynamic = 'force-dynamic'` utilisé partout
     où nécessaire — mais pas inutilement sur les pages statiques
   - Headers cache HTTP corrects sur les API routes (exports)

LIVRABLE : Tableau Lighthouse + Top 5 requêtes lentes +
Plan d'optimisation.

═══════════════════════════════════════════════════════════════
AXE 4 — COHÉRENCE MÉTIER OIF
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Terminologie OIF (lib/oif/terminologie-officielle.ts V2.5.1)
   - 53 États et gouvernements membres de plein droit
   - 5 membres associés
   - 32 observateurs
   - Total : 90 États et gouvernements (chiffres 2025)
   - CRITIQUE : ne jamais utiliser "partenaires" pour les États
     membres — ils sont membres, pas partenaires
   - Vérifier que les composants UI, le chatbot SCS, l'assistant
     IA et les exports utilisent bien la terminologie officielle
   - Le chatbot est-il briefé sur cette distinction ?

B. Indicateurs OIF (18 indicateurs CMR V2)
   - Indicateurs implémentés : A1-A5, B1-B4, C1-C5, D1-D3, F1
   - Définitions conformes au Cadre Commun V2
     (docs/specifications/questionnaires/)
   - Pages /realisations : les 3 piliers affichent bien les
     indicateurs correspondants
   - Page /indicateurs : les 18 indicateurs avec valeurs
     annuelles et config (doitAfficherVisualisation)
   - Saisies manuelles (valeurs_indicateurs_saisies) :
     publication cohérente avec les calculs auto

C. Projets OIF (23 codes officiels)
   - PROJ_A01a, PROJ_A01b, PROJ_A01c, PROJ_A02...PROJ_A20
   - Codes courts acceptés par le smart-mapper :
     P14 → PROJ_A14, P16a → PROJ_A16a, etc.
   - CHECK constraint en base : code ~ '^PROJ_A[0-9]{1,2}[a-z]?$'
   - Les 8 projets Emploi Jeunes actifs :
     PROJ_A14 à PROJ_A20 → bien identifiés dans PROJETS_EMPLOI_JEUNES_CODES

D. Charte graphique OIF
   - Logo OIF officiel (docs/branding/sources/)
   - Couleurs programmes stratégiques :
     · PS1 (Education) : #0198E9
     · PS2 (Diversité/Démocratie) : #5D0073
     · PS3 (Economie/Emploi) : #7EB301
   - Typographie cohérente sur toute la plateforme
   - Application mobile Capacitor : splash screen bleu #0E4F88,
     spinner doré #F5A623 — cohérent avec charte ?

E. Conformité institutionnelle
   - Mention "© OIF" présente sur toutes les pages publiques
   - Liens vers francophonie.org corrects
   - Nom officiel de l'application cohérent :
     Capacitor appName = 'OIF Emploi Jeunes' ✓
     appId = 'org.francophonie.emploijeunes' ✓
   - Contenu chatbot SCS : pas de réponse non validée par SCS

LIVRABLE : Liste des incohérences métier +
recommandations.

═══════════════════════════════════════════════════════════════
AXE 5 — TESTS ET QUALITÉ DE CODE
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Couverture de tests
   - 38 fichiers de tests unitaires Vitest dans tests/unit/ :
     vérifier qu'ils passent tous en vert (npx vitest run)
   - Fichiers clés à valider :
     · smart-mapper.spec.ts — inclut-il les nouveaux normalizers
       B1 (normaliserTypeStructure, normaliserSecteurActivite,
       normaliserStatutCreation, normaliserNatureAppui) ?
     · ia-extractor.spec.ts — couvre-t-il les cas edge ?
     · ia-anonymisation.spec.ts — regex email/tel/UUID ?
     · imports-mapping.spec.ts — mapLigneVersStructure ?
     · imports-parser.spec.ts — parser-excel-flexible.ts ?
   - MANQUE IDENTIFIÉ : pas de tests pour ia-extractor-structures.ts
     et import-structures-ia.ts (créés ce sprint)
   - Tests E2E Playwright : vérifier playwright.config.ts
     et les scénarios couverts
   - Tests des cas limites : import IA avec fichier vide,
     consentement null, projet inconnu, pays inconnu

B. TypeScript
   - Mode strict activé (tsconfig.json)
   - Vérifier 0 erreur : npx tsc --noEmit --skipLibCheck
   - Pas de @ts-ignore non justifiés
   - Les `as never` dans les insertions Supabase sont-ils
     justifiés ou peuvent-ils être typés proprement ?
   - Types métier centralisés dans lib/schemas/nomenclatures.ts ✓

C. Lint et formatage
   - npx next lint — 0 warning toléré
   - Prettier appliqué partout
   - Pre-commit hooks fonctionnels (husky ?)
   - Vérifier les TODO/FIXME dans le code source

D. Build production
   - npm run build sans erreur ni warning
   - Bundle analysis : vérifier les dépendances côté client
   - Tree shaking effectif pour Anthropic SDK, mammoth, unpdf

E. Documentation code
   - Fonctions complexes commentées (smart-mapper,
     ia-extractor, import-beneficiaires)
   - README.md : présent et à jour ?
   - CHANGELOG.md : ABSENT — à créer
   - Schémas BDD documentés (docs/architecture.md à jour ?)
   - Procédures déploiement documentées

LIVRABLE : Score qualité par module + dette technique
identifiée.

═══════════════════════════════════════════════════════════════
AXE 6 — ACCESSIBILITÉ (WCAG 2.1)
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Navigation clavier
   - Tous les éléments interactifs accessibles au clavier
   - Focus visible et logique sur dialogs (DialogueRapportImport,
     DialogueRapportImportEnrichi)
   - ZoneUploadImport : drag-and-drop accessible au clavier ?
   - Skip links pour lecteurs d'écran
   - Pas de pièges au focus dans les modales

B. Contraste
   - Texte / fond : ratio min 4.5:1 (AA)
   - Bleu OIF (#0E4F88 ou #0198E9) sur fond clair
   - Badges couleur (projets, statuts) : texte lisible ?
   - Mode sombre (dark:) vérifié

C. Sémantique
   - HTML5 sémantique
   - Hiérarchie de titres (h1 unique par page)
   - Alt sur toutes les images (logo OIF notamment)
   - ARIA labels sur les composants shadcn/ui personnalisés

D. Formulaires
   - Labels associés aux inputs dans les formulaires
     bénéficiaire, structure, enquête
   - Messages d'erreur Zod clairs et accessibles
   - ZoneUploadImport : état "glisser-déposer" communiqué
     aux lecteurs d'écran ?

E. Application mobile (Capacitor)
   - Le mode remote-server WebView hérite de l'accessibilité
     web — pas de régression à vérifier spécifiquement
   - Taille des zones de touch : 44×44px minimum (iOS HIG)

LIVRABLE : Rapport WCAG 2.1 AA + roadmap vers AAA.

═══════════════════════════════════════════════════════════════
AXE 7 — UX ET ERGONOMIE
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Parcours utilisateur clés
   - Login → dashboard : < 3 clics
   - Import bénéficiaires A1 Excel : workflow complet + rapport
   - Import bénéficiaires A1 IA (PDF/DOCX/TXT) : toggle IA,
     extraction, rapport enrichi 5 statuts
   - Import structures B1 Excel : workflow + rapport classique
   - Import structures B1 IA (PDF/DOCX/TXT) : nouveau, à tester
   - Saisie manuelle indicateur annuel + publication
   - Analyse IA d'un indicateur (super_admin)
   - Wizard enquête : création → lancement → collecte → export
   - Chatbot SCS public : 3 questions → redirection pertinente

B. Feedback utilisateur
   - Loading states sur toutes les ZoneUploadImport
   - Rapport d'import : compteurs + détail erreurs bien lisibles
   - Bouton Copier dans DialogueRapportImportEnrichi :
     feedback visuel (icône Check 2s) ✓
   - Messages succès / erreur via toast (sonner)
   - Confirmations sur actions destructives (suppression,
     rollback import)

C. Responsive (47 pages)
   - Desktop 1920px et 1366px : layout optimal
   - Tablette 768px : sidebar collapsible
   - Mobile 375px via Capacitor : touch-friendly
   - ZoneUploadImport : utilisable sur mobile ?
   - DialogueRapportImport : max-h-[90vh] sur petit écran

D. Cohérence design
   - Boutons : primary / secondary / destructive / outline
     uniformes sur les 47 pages
   - Badges statuts : couleurs cohérentes entre les entités
     (bénéficiaires, structures, enquêtes)
   - Tableaux : même composant Table shadcn/ui partout
   - Toggle IA (iaDispo) : visible uniquement pour PDF/DOCX/TXT,
     masqué pour .xlsx — comportement cohérent B1 et A1 ?

E. Internationalisation
   - Tout en français (locale fr)
   - Dates au format français (DD/MM/YYYY)
   - Nombres avec séparateur espace (5 512, pas 5,512)
   - Devises EUR avec symbole correct
   - ATTENTION : composants Radix UI / shadcn/ui ont parfois
     des textes en anglais (aria-labels, placeholders)

LIVRABLE : UX audit avec captures + recommandations.

═══════════════════════════════════════════════════════════════
AXE 8 — DOCUMENTATION
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Documentation technique existante (docs/)
   - docs/architecture.md — à vérifier à jour avec v2.5.x
   - docs/configuration/resend-setup.md ✓
   - docs/configuration/capacitor-mobile.md ✓
   - docs/configuration/bootstrap-admin.md ✓
   - docs/utilisation/transfert-projet.md ✓
   - MANQUE : diagramme du pipeline import IA (A1 et B1)
   - MANQUE : schéma des 51 migrations et leur ordre

B. Documentation utilisateur
   - MANQUE : guide super_admin (modules, analyses IA,
     base de connaissance, partenaires, tracking)
   - MANQUE : guide admin_scs (imports, utilisateurs, alertes)
   - MANQUE : guide editeur_projet (imports, indicateurs)
   - MANQUE : guide contributeur_partenaire (saisie terrain)
   - Existe : docs/maquette-andre.html (maquette UI)

C. Documentation API
   - Server actions commentées (~50 actions) ✓ partiellement
   - MANQUE : liste exhaustive des routes API :
     · POST /api/imports/beneficiaires
     · POST /api/imports/beneficiaires-ia  [IA]
     · POST /api/imports/structures
     · POST /api/imports/structures-ia     [IA — nouveau]
     · POST /api/imports/rapport-erreurs
     · GET  /api/beneficiaires/export
     · GET  /api/structures/export
     · GET  /api/enquetes/export
     · POST /api/chatbot-scs
     · POST /api/auth/callback
     · POST /api/auth/sign-out
   - Schémas BDD : migrations annotées ✓ partiellement

D. Onboarding
   - Procédure setup dev local : dans README ?
   - Script seed démo : npm run seed:demo ✓
   - MANQUE : README.md n'existe probablement pas ou est vide

E. Changelog et versionning
   - MANQUE CRITIQUE : CHANGELOG.md absent
   - Tags Git annotés : à vérifier
   - Releases GitHub : à vérifier

LIVRABLE : Audit doc + manques identifiés.

═══════════════════════════════════════════════════════════════
AXE 9 — DEVOPS ET PRODUCTION
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Déploiement
   - Build production sans erreur : npm run build
   - Variables d'env prod configurées (Vercel dashboard) :
     · NEXT_PUBLIC_SUPABASE_URL
     · NEXT_PUBLIC_SUPABASE_ANON_KEY
     · SUPABASE_SERVICE_ROLE_KEY
     · ANTHROPIC_API_KEY
     · RESEND_API_KEY (emails)
   - Domaine suivi-projet.org SSL actif
   - Vercel deployment fonctionnel (dernière build verte ?)

B. Monitoring
   - MANQUE CRITIQUE : Sentry absent (non dans package.json)
     → les erreurs 500 production ne sont pas alertées
   - Vercel Analytics : présent dans package.json ?
   - Logs Vercel accessibles pour debug production
   - Rate limit chatbot en mémoire JS (Map) → reset à chaque
     cold start Vercel — protection insuffisante en production

C. CI/CD
   - GitHub Actions configuré ? (.github/workflows/)
   - Tests automatiques sur PR ? (vitest + tsc)
   - Build vérifié avant merge ?
   - Rollback procédure : Vercel permet le rollback en 1 clic —
     documenté ?

D. Backups Supabase
   - Backups quotidiens automatiques actifs (plan Pro ?)
   - Test de restauration effectué ?
   - Plan de continuité en cas de panne Supabase

E. Application mobile Capacitor
   - Mode remote-server : pointe sur https://suivi-projet.org ✓
   - allowNavigation : ['suivi-projet.org', '*.supabase.co',
     'francophonie.org'] ✓
   - cleartext: false (HTTPS only) ✓
   - webContentsDebuggingEnabled: false en prod ✓
   - Build iOS testé (au moins simulateur) ?
   - Build Android testé ?
   - Procédure release App Store / Play Store documentée ?
     (docs/configuration/capacitor-mobile.md)

LIVRABLE : Checklist production-ready avec gaps.

═══════════════════════════════════════════════════════════════
AXE 10 — IA ET SÉCURITÉ DES MODÈLES
═══════════════════════════════════════════════════════════════

VÉRIFICATIONS :

A. Assistant IA analytique (/assistant-ia)
   - Anonymisation effective :
     · anonymiserTexte() — regex email, tel, UUID, noms
     · Test avec dump contenant des PII réelles
     · Que se passe-t-il avec un tableau Excel collé en texte ?
   - Feature flag module `assistant_ia` par rôle
     (super-admin/modules) — toggle fonctionnel ?
   - Rate limiting par utilisateur : présent dans server-actions.ts ?
   - Pièces jointes (image + texte, max 5, max 50 000 chars) :
     validation correcte ?
   - Audit log : chaque appel Claude est-il tracé dans
     journaux_audit ?
   - Modèle utilisé : Claude Sonnet ou Haiku pour l'analytique ?
   - Base de connaissance : upload-actions.ts — les documents
     uploadés sont-ils validés (type, taille) ?

B. Analyses IA par indicateur (super-admin/analyses-indicateurs)
   - Accès strictement super_admin (exigerSuperAdmin()) ✓
   - Modèle : Claude Sonnet (analyses-indicateurs/server-actions.ts)
   - Les analyses générées sont-elles sauvegardées en brouillon
     avant publication ?
   - Workflow brouillon → publiée → modification → suppression
     cohérent ?
   - Les analyses publiées sont-elles visibles par d'autres rôles ?
   - Pas d'injection via les valeurs d'indicateurs transmises à Claude

C. Pipelines Import IA (A1 et B1)
   - Feature flag `import_ia` par rôle ✓
   - Max texte source : 50 000 caractères → ~12k tokens Haiku ✓
   - Max lignes extraites : 100 par appel ✓
   - Timeout : 30s ✓
   - Modèle : claude-haiku-4-5-20251001 ✓ (confirmé dans code)
   - Prompt injection : un utilisateur malveillant peut-il injecter
     des instructions dans un PDF pour manipuler l'extraction ?
     → Risque modéré : les valeurs extraites passent par le
       smart-mapper + Zod → validation suffisante ?
   - Import B1 IA : consentement = false par défaut → les lignes
     `incomplete` sont bien signalées dans le rapport enrichi ?
   - tokens_utilises est loggé ? (audit coûts)

D. Chatbot SCS public (/api/chatbot-scs)
   - Pré-filtrage hors-sujet : HORS_SUJET_KEYWORDS (combien de
     mots ?) — efficace ?
   - Rate limit 30 req/h par IP en mémoire — insuffisant en prod
     (voir Axe 9)
   - Pas de persistance BDD des messages ✓ (localStorage client)
   - Sources circonscrites au SYSTEM_PROMPT_INSTITUTIONNEL
   - Hallucinations sur chiffres clés OIF : à tester
   - Modèle utilisé : quel Claude ? (vérifier config dans route.ts)
   - Refus poli des hors-sujet avec suggestions SUGGESTIONS_REDIRECTION

E. Coûts et conformité IA
   - MANQUE : pas de tracking de consommation Anthropic API
     dans la plateforme
   - Estimation coût mensuel pilote (60 partenaires) :
     · Chatbot SCS : ~N appels/jour × coût Haiku/Sonnet
     · Import IA : ~M imports/mois × tokens moyens
     · Assistant analytique : ~K sessions/semaine
     · Analyses indicateurs : 18 × génération = coût fixe
   - Mention IA visible dans l'UI (badge, disclaimer)
   - Disclaimer "réponses IA, à vérifier" présent ?
   - ANTHROPIC_API_KEY rotation : procédure en place ?
   - Conformité DPA Anthropic pour les données OIF (RGPD)

LIVRABLE : Audit sécurité IA + estimation coûts.

═══════════════════════════════════════════════════════════════
POINTS D'ATTENTION TRANSVERSES (NOUVELLES DEPUIS V2.4)
═══════════════════════════════════════════════════════════════

Ces éléments ont été ajoutés dans les derniers sprints et
méritent une attention particulière lors de l'audit :

1. PIPELINE IMPORT IA B1 (nouveau ce sprint v2.6-pre)
   - Fichiers : lib/imports/ia-extractor-structures.ts,
     import-structures-ia.ts, app/api/imports/structures-ia/route.ts
   - Normalizers B1 dans smart-mapper.ts (lignes ~650-880)
   - Tests unitaires MANQUANTS pour ces modules
   - Consentement = false par défaut pour les imports IA B1

2. SMART-MAPPER NORMALIZERS B1 (lignes ~650-880)
   - normaliserTypeStructure, normaliserSecteurActivite,
     normaliserStatutCreation, normaliserNatureAppui
   - Ces fonctions retournent 'AUTRE' comme fallback
     (comportement différent de normaliserStatut qui retourne null)
   - À documenter et tester

3. ROLLBACK D'IMPORT (20260512100001)
   - Système de sessions d'import avec rollback dans la fenêtre
   - Vérifier que le rollback est fonctionnel et limité dans le temps
   - Qui peut déclencher un rollback ? (tous les rôles autorisés ?)

4. SAISIES MANUELLES INDICATEURS (20260512300001 + 400001)
   - valeurs_indicateurs_saisies : nouveau mécanisme parallèle
     aux calculs automatiques
   - Publication des saisies : workflow brouillon → publié
   - Cohérence avec les valeurs calculées auto ?

5. ANALYSES IA PAR INDICATEUR (super-admin uniquement)
   - Workflow complet : générer → brouillon → publier → modifier
   - Les analyses publiées sont-elles cachées correctement ?

6. TRANCHE D'ÂGE (migration 20260511000001)
   - Harmonisation tranche_age_declaree dans les enquêtes
   - Vérifier cohérence : enquêtes vs imports vs affichage

7. PURGE PROJETS NON OFFICIELS (migration 20260512500001)
   - CHECK constraint projets.code ajoutée
   - Vérifier qu'aucun code non conforme ne subsiste
   - Impact sur les affectations, bénéficiaires, structures

═══════════════════════════════════════════════════════════════
PROCÉDURE D'EXÉCUTION DE L'AUDIT
═══════════════════════════════════════════════════════════════

1. PHASE DIAGNOSTIC (4-6h)
   Commandes à exécuter en premier :
   ```bash
   # TypeScript strict
   npx tsc --noEmit --skipLibCheck

   # Lint
   npx next lint

   # Tests unitaires
   npx vitest run

   # Recherche TODO/FIXME
   grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" \
     lib/ app/ components/ | grep -v node_modules

   # Recherche @ts-ignore
   grep -r "@ts-ignore\|@ts-nocheck" --include="*.ts" --include="*.tsx" \
     lib/ app/ components/

   # Vérifier les `as never` (pattern suspect)
   grep -rn "as never" lib/ app/ components/ | grep -v node_modules

   # Recherche de clés API hardcodées
   grep -rn "sk-ant\|ANTHROPIC_API_KEY.*=.*sk\|service_role" \
     lib/ app/ --include="*.ts" --include="*.tsx"

   # Vérifier .env dans .gitignore
   cat .gitignore | grep -E "\.env"

   # Lister les routes API
   find app/api -name "route.ts" | sort

   # Coverage des nouveaux modules (B1 IA)
   grep -l "ia-extractor-structures\|import-structures-ia" tests/unit/ \
     2>/dev/null || echo "MANQUE: tests B1 IA absents"

   # Vérifier CHANGELOG
   ls CHANGELOG.md 2>/dev/null || echo "MANQUE: CHANGELOG.md absent"

   # Vérifier README
   ls README.md 2>/dev/null || cat README.md | head -20
   ```

2. PHASE ANALYSE (2-3h)
   - Classification des findings par axe
   - Évaluation impact / effort
   - Priorisation CRITIQUE / HAUTE / MOYENNE / FAIBLE

3. PHASE RAPPORT (2h)
   - Document /docs/audits/audit-v2.6-pre-pilote.md
   - Tableau récapitulatif des findings
   - Plan de remédiation chiffré

4. PHASE LIVRAISON
   - Commit /docs/audits/audit-v2.6-pre-pilote.md
   - Créer CHANGELOG.md si absent
   - Tag v2.6.0-audit (documentation only)

═══════════════════════════════════════════════════════════════
FORMAT DU RAPPORT FINAL
═══════════════════════════════════════════════════════════════

Fichier : /docs/audits/audit-v2.6-pre-pilote.md

Structure :

# Audit complet pré-pilote — v2.6
## Synthèse exécutive
- Stack : Next.js 14 / Supabase / TypeScript / Anthropic
- Score global : X/100
- Findings : N critiques, N hautes, N moyennes, N faibles
- Recommandation pilote : GO / NO-GO / GO conditionnel

## État de la plateforme (snapshot)
- Pages : 47 (dashboard + public)
- Server Actions : ~50
- Routes API : 11
- Migrations : 51
- Tests unitaires : 38 fichiers spec
- Indicateurs CMR : 18
- Projets OIF : 23 codes officiels
- Rôles : 5

## Findings par axe
Pour chaque finding :
- ID unique (FIND-001, FIND-002...)
- Axe concerné
- Criticité (🔴 Critique / 🟠 Haute / 🟡 Moyenne / 🟢 Faible)
- Description précise
- Fichier(s) concerné(s) avec numéro de ligne si possible
- Reproduction (étapes ou requête SQL)
- Impact métier
- Recommandation
- Effort estimé (Xh)

## Plan de remédiation
- Sprint v2.7 (critiques) : ...
- Sprint v2.8 (hautes) : ...
- Sprint v2.9+ (moyennes/faibles) : ...

## Conclusion

═══════════════════════════════════════════════════════════════
ESTIMATION
═══════════════════════════════════════════════════════════════

DURÉE : 10-14h sur 2-3 jours (Claude Code en mode audit
approfondi)
LIVRABLE : 1 rapport markdown structuré + tag Git
PAS DE MODIFICATION DE CODE — UNIQUEMENT DIAGNOSTIC

═══════════════════════════════════════════════════════════════
CARTE BLANCHE QUALITÉ SENIOR
═══════════════════════════════════════════════════════════════

Cet audit est crucial avant le pilote 15 juin avec 60
partenaires. Il faut identifier TOUS les risques pour
permettre une remédiation ciblée.

Accès complet au dépôt Git. Ne pas hésiter à :
  - Signaler les choix architecturaux discutables
    (ex : rate limiting en mémoire JS plutôt que Redis)
  - Identifier les dépendances obsolètes ou à risque
  - Lister les TODO/FIXME du code source
  - Recommander des outils manquants (Sentry, Redis, etc.)
  - Vérifier la cohérence entre les 51 migrations et l'état
    réel des tables en production
  - Tester les cas limites de l'IA (prompt injection dans
    les PDFs importés)
  - Simuler chaque rôle et vérifier les permissions

L'audit doit être un MIROIR FIDÈLE de l'état réel de la
plateforme, sans complaisance. Le pilote du 15 juin ne
peut pas se permettre de découvrir des problèmes devant
60 partenaires OIF.

Bon audit.
