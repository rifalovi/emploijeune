# Procédure — Transférer un projet entre coordonnateurs

> Mode admin SCS · V1 · 27 avril 2026

## Quand utiliser cette procédure

Quand un projet géré par un coordonnateur (chef de projet) doit basculer
sous la responsabilité d'un autre :
- Départ d'un coordonnateur de l'organisation OIF.
- Réorganisation interne (changement de portefeuille).
- Renforcement de capacité (passage d'un projet à un référent plus expert).
- Mise au repos temporaire d'un coordonnateur.

## Ce que fait le transfert (techniquement)

1. Le coordonnateur source perd l'accès au projet (RLS appliquée
   immédiatement à sa prochaine requête).
2. Le coordonnateur destination reçoit l'accès (RLS appliquée).
3. L'historique conserve les deux lignes :
   - Source : ligne fermée avec `date_fin`, `transfere_a`, `raison_fin`.
   - Destination : nouvelle ligne ouverte avec `transfere_par`, `raison_debut`.
4. `journaux_audit` enregistre les 4 opérations BDD via les triggers.

Pas de modification des bénéficiaires/structures/enquêtes du projet —
seul le coordonnateur change.

## Procédure pas à pas

1. **Connexion** en tant qu'`admin_scs` sur la plateforme.
2. **Aller** sur `/admin/utilisateurs`.
3. **Trouver** le coordonnateur source dans la liste.
4. **Ouvrir** sa fiche d'édition (menu ⋯ → « Modifier les détails »).
5. **Localiser** la card « Projets gérés ».
6. **Cliquer** sur « Transférer ».
7. **Renseigner** dans la modal :
   - Le projet à transférer (parmi ceux gérés par la source).
   - Le coordonnateur destination (autres coordonnateurs actifs).
   - Le rôle dans le projet (gestionnaire principal ou co-gestionnaire).
   - **La raison du transfert** (obligatoire, ≥ 3 caractères ; conservée
     dans l'historique : « Marie a quitté l'OIF en avril 2026 », par
     exemple).
8. **Confirmer**.
9. **Vérifier** dans la card « Projets gérés » que le projet a disparu
   de la liste de la source.
10. **Optionnel** : ouvrir la fiche du destinataire pour confirmer
    l'apparition du projet dans sa card.

## Bonnes pratiques

- **Toujours préciser la raison** : c'est ce qui rend l'historique
  exploitable lors d'audits OIF. Une raison vague (« changement »)
  vide le journal de sa valeur.
- **Faire le transfert avant la désactivation** du coordonnateur
  sortant : si vous désactivez d'abord, le coordonnateur sortant
  n'apparaîtra plus dans le menu de sélection (filtre `actif = TRUE`).
- **Cas du dernier coordonnateur d'un projet** : aucune sécurité BDD
  ne l'empêche en V1, mais à signaler dans la procédure pour ne pas
  laisser un projet sans pilote (V1.5 : alerte UI si transfert vers un
  utilisateur déjà chargé).

## Que faire si le transfert échoue ?

L'opération est best-effort en V1 (pas de transaction SQL atomique). En
cas d'échec partiel (ex. clôture historique OK mais INSERT destination
échoue) :

1. Le toast affichera le message d'erreur précis.
2. Vérifier dans `/admin/utilisateurs/[id]/historique` la cohérence.
3. Si une ligne historique est fermée mais aucune ligne n'a été créée
   chez le destinataire : ré-attribuer manuellement le projet via le
   bouton « Ajouter » sur la fiche du destinataire (cela créera une
   nouvelle paire courante + historique, et l'incohérence intermédiaire
   reste tracée dans `journaux_audit`).
4. **Ne pas paniquer** : aucune donnée bénéficiaire/structure n'est
   touchée — seule la ligne d'affectation est concernée.

## V1.5 prévu

- Modal « Transfert en lot » (plusieurs projets en une opération).
- Dry-run avant confirmation (preview des changements RLS).
- RPC SQL atomique pour rendre l'opération transactionnelle.
