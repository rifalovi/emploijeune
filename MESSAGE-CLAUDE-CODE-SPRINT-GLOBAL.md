# 📨 MESSAGE À COLLER À CLAUDE CODE

**Copiez tout ce qui est ci-dessous et collez-le à Claude Code.**

---

═══════════════════════════════════════════════════════════════
SPRINT GLOBAL — V1.0 → V1.5 ENRICHIE
Migration données réelles + Vitrine publique + Charte OIF
═══════════════════════════════════════════════════════════════

V1.0.0 publiée et stable. Place au sprint global d'enrichissement avant pilote juin 2026.

OBJECTIF GLOBAL :

Transformer la plateforme outil en plateforme institutionnelle vitrine en :
1. Adoptant la charte graphique OFFICIELLE OIF
2. Migrant 5 618 bénéficiaires + 341 structures RÉELS
3. Créant une page d'accueil PUBLIQUE institutionnelle  
4. Adaptant les questionnaires officiels V2
5. Créant 4 utilisateurs de démonstration

DOCUMENT DE BRIEF DÉTAILLÉ :

J'ai préparé un document de référence exhaustif : 
`docs/BRIEF-SPRINT-GLOBAL.md`

Ce document contient :
- Toutes les ressources OIF disponibles avec leurs emplacements
- Les 5 sprints détaillés avec spécifications techniques
- Le mapping des codes projets (P14 → PROJ_A14)
- Les couleurs officielles PS1/PS2/PS3
- Les fonctions PostgreSQL à créer
- Les composants React à créer
- L'architecture des routes
- Les tests à exécuter
- La procédure RGPD pour la migration des données

RESSOURCES À INTÉGRER AU PROJET :

Carlos a transmis les ressources OIF officielles :

1. Logos OIF (PNG + EPS)
   → À placer dans `public/assets/logo/`
   - Logo_OIF_couleur__2_.png (principal)
   - Logo_OIF_blanc.eps
   - Logo_OIF_noir.eps  
   - Logo_OIF_quadri.eps

2. Charte graphique officielle
   → À placer dans `docs/charte/`
   - OIF_mini_charte.pdf (10 pages, règles d'utilisation)
   - Code_couleur_programmation_OIF.pdf

3. Documents méthodologiques
   → À placer dans `docs/methodologie/`
   - Cadre_de_mesure_du_rendement_emploi_V2.docx
   - Note_méthodologique_V2.docx
   - Questionnaire_EmploiJeunes_Indicateurs_A_V2.docx
   - Questionnaire_EmploiJeunes_Indicateurs_B_V2.docx

4. Référentiel des projets
   → À placer dans `data/oif/`
   - Liste_de_projets_selon_la_Programmation_OIF.xlsx (65 projets)

5. Base de données réelle
   → À placer dans `data/oif/import/`
   - Base_de_sondage_EmploiJeune_Global_230426_V2.xlsm (5 618 bénéficiaires + 341 structures)

ARBITRAGES DÉJÀ TRANCHÉS :

- Couleurs PS officielles : PS1=#0198E9, PS2=#5D0073, PS3=#7EB301
- Anonymisation : Stratégie hybride (données réelles en base, agrégats publics anonymisés)
- Consentement RGPD : Réputé acquis pour migration (collecte initiale OIF)
- Ordre sprints : 1 → 2 → 5 → 3 → 4
- Tag par sprint : v1.1.0, v1.2.0, v1.3.0, v1.4.0, v1.5.0

PROCÉDURE EN AUTONOMIE MAX :

1. Lire intégralement docs/BRIEF-SPRINT-GLOBAL.md
2. Sprint 1 — Charte OIF (2-3h) → tag v1.1.0
3. Sprint 2 — Migration données (4-5h) → tag v1.2.0
4. Sprint 5 — Utilisateurs démo (1-2h) → tag v1.3.0
5. Sprint 3 — Vitrine publique (5-6h) → tag v1.4.0
6. Sprint 4 — Questionnaires (2-3h) → tag v1.5.0

ESTIMATION : 14-18 heures

CONTRAINTES IMPORTANTES :

- Aucune régression sur la V1.0.0 stable
- Tous les tests Vitest doivent rester verts (443 actuels + nouveaux)
- TypeScript strict
- Lint clean
- Build OK
- Tests visuels par Carlos après chaque sprint

VALIDATION SCS REQUISE :

Après chaque sprint, STOP et rapport au format docs/collaboration-ia.md.
Carlos validera visuellement avant de débloquer le sprint suivant.

QUESTIONS STRATÉGIQUES :

Si tu rencontres une question stratégique : STOP et documente.
Carlos arbitrera dès la lecture du rapport.

QUESTIONS TECHNIQUES :

Décide en autonomie selon les patterns existants :
- Schémas Zod hors 'use server'
- RLS Supabase 4 rôles
- Audit log systématique
- Server Actions sécurisées
- Validation client + serveur

RAPPORT FINAL ATTENDU :

Pour chaque sprint, rapport au format collaboration-ia.md avec :
- Commits poussés (SHA + sujet)
- Tags posés
- Métriques (tests, lignes, fichiers)
- À faire côté Carlos
- Hors scope V1.5 (signalé)

Excellent travail jusqu'à présent. Le sprint global est ambitieux mais bien cadré.

Bon code.

---

# 📦 RESSOURCES À TÉLÉCHARGER

Carlos te transmettra :

1. **BRIEF-SPRINT-GLOBAL.md** — Document de référence détaillé (38 KB, 1300+ lignes)
2. **sprint-global-ressources.zip** — Archive avec toutes les ressources OIF :
   - Logo OIF (couleur, blanc, noir, quadri)
   - Charte graphique PDF
   - Code couleur PDF
   - Documents méthodologiques
   - Questionnaires V2
   - Référentiel projets Excel
   - Base de sondage Excel
   - CSV pré-extraits (bénéficiaires, structures, projets)
   - Stats JSON

Procédure pour Carlos :
1. Télécharger les 2 fichiers depuis la conversation
2. Les placer à la racine du projet
3. `unzip sprint-global-ressources.zip` pour extraire les ressources
4. Suivre `BRIEF-SPRINT-GLOBAL.md` (toutes les instructions sont dedans)
