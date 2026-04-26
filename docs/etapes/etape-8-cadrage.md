# Étape 8 enrichie — Édition complète des utilisateurs (cadrage)

> Cadrage rétrospectif rédigé pendant la livraison (sprint nocturne
> 26→27 avril 2026, en autonomie max).
>
> Version : 1.0 — 27 avril 2026

## 1. Objectif

Permettre à un `admin_scs` de gérer COMPLÈTEMENT le cycle de vie d'un
compte utilisateur : modifier le nom, le rôle, le rattachement
organisation, activer/désactiver, avec audit automatique de chaque
modification.

## 2. Périmètre V1

### Page `/admin/utilisateurs/[id]/modifier`

- Accessible uniquement aux `admin_scs` (notFound sinon).
- Layout 5 cards :
  1. **Informations personnelles** : nom complet (modifiable). Email
     en lecture seule (V1.5 : workflow de changement avec re-vérification).
  2. **Rôle** : Select des 4 rôles (admin_scs / editeur_projet /
     contributeur_partenaire / lecteur). AlertDialog de confirmation
     si changement.
  3. **Rattachement organisation** : Select des organisations actives.
     Aperçu des projets gérés (lecture seule — édition via page admin
     organisations en V1.5).
  4. **Statut** : toggle actif/désactivé. Champ raison optionnel
     (tracé dans journaux_audit). Désactivation = signOut immédiat.
  5. **Audit** : 10 dernières lignes `journaux_audit` filtrées sur
     cet utilisateur, avec action + horodatage + diff JSONB en accordéon.

### Server Action `modifierUtilisateur`

- Garde rôle `admin_scs`.
- Validation Zod via `modifierUtilisateurSchema` (hors `'use server'`).
- Détection diff (champs réellement modifiés).
- 3 garde-fous métier critiques :
  1. **Pas d'auto-modification du rôle** : un admin ne peut pas changer
     son propre rôle.
  2. **Pas d'auto-désactivation** : un admin ne peut pas se désactiver
     lui-même.
  3. **Pas de retrait du dernier admin_scs actif** : si la cible est le
     dernier admin actif, refus de la déclasser ou désactiver.
- UPDATE `public.utilisateurs` — l'audit est AUTOMATIQUE via le trigger
  `trg_utilisateurs_audit` qui écrit dans `journaux_audit` avec le diff
  avant/après et le `user_id` de l'admin connecté.
- Si `raison_changement` fourni : ajoute une seconde ligne audit
  contextuelle avec la raison libre + liste des champs modifiés.
- Si désactivation : `auth.admin.signOut(user_id)` invalide la session
  active de l'utilisateur cible.

### Lien depuis `/admin/utilisateurs`

- Item « Modifier les détails » ajouté en TÊTE du menu ⋯ existant
  (avant Réinitialiser mdp et Désactiver/Activer).
- Link vers `/admin/utilisateurs/[id]/modifier`.

## 3. Hors scope V1 (reportés V1.5)

- **Modification email** : impacte `auth.users` + cohérence sessions.
  En V1, supprimer + recréer le compte.
- **Édition fine des projets gérés par une organisation** : la table
  `organisations.projets_geres TEXT[]` est éditable mais sans UI dédiée
  en V1. La page `/admin/organisations/[id]` viendra en V1.5.
- **Historique d'audit complet** : V1 affiche 10 lignes max. V1.5 :
  page `/admin/audit` avec filtres + pagination.
- **Suppression de compte** : V1 ne fait que désactiver (`actif=false`).
  La suppression définitive (DELETE auth.users + soft-delete utilisateurs)
  reste manuelle via console Supabase. V1.5 : Server Action dédiée.

## 4. Patterns réutilisés

- Schémas Zod hors `'use server'` (cf. hotfix 6.5h-quater).
- Server Actions avec discriminated union (`ModifierUtilisateurResult`).
- service_role uniquement côté serveur pour `auth.admin.signOut` et
  lecture `auth.users` email + `journaux_audit`.
- Trigger d'audit automatique (déjà en place migration 001).
- 4 cards layout cohérent avec `/admin/utilisateurs` et autres pages.

## 5. Risques techniques identifiés

### R1 — Détection « dernier admin_scs »

Si un admin tente de se déclasser (rôle != admin_scs) ALORS qu'il est le
dernier actif : COUNT(*) WHERE role='admin_scs' AND actif=true devient 0
après update → plus aucun admin → plateforme inutilisable. **Mitigation** :
COUNT pré-update + refus (`erreur_dernier_admin`).

### R2 — Race condition sur signOut

L'utilisateur cible peut avoir une session active en cours d'usage.
`auth.admin.signOut(user_id)` invalide la session côté serveur, mais
le client peut conserver le token JWT en mémoire jusqu'à expiration
(par défaut 1h). **Comportement V1** : la prochaine requête échouera
côté Supabase. Acceptable pour V1, à envisager hardening V1.5 si retour
terrain (broadcast invalidation via Realtime).

### R3 — Audit trigger non vérifié dans cette étape

Le trigger `trg_utilisateurs_audit` existe depuis migration 001 mais
n'a jamais été testé end-to-end avec une vraie modification. Si bug du
trigger, l'audit ne sera pas alimenté → la card 5 reste vide. Carlos
le constatera lors des tests visuels post-pull.

## 6. Tests d'acceptance

`tests/unit/utilisateur-modifier-schema.spec.ts` (10 tests) :
- Payload valide
- UUID invalide rejeté
- nom_complet trop court / avec chiffres rejeté
- nom_complet accents accepté
- Rôle hors enum rejeté
- organisation_id vide/null acceptés (Aucune)
- raison >500 chars rejetée
- actif obligatoire
- Cardinalité ROLES_MODIFIABLES = 4 (admin_scs inclus)
- Tous les libellés présents

## 7. Procédure utilisateur

1. SCS va sur `/admin/utilisateurs`.
2. Clique sur ⋯ d'une ligne → « Modifier les détails ».
3. Modifie les champs nécessaires sur la page d'édition.
4. Si changement de rôle : confirmation explicite obligatoire.
5. Si désactivation : peut saisir une raison (tracée audit).
6. Clique « Enregistrer » → toast résultat + redirect vers la liste.
7. Audit visible immédiatement dans la card 5 lors de la prochaine
   visite de la page d'édition.

## Changelog

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-04-27 | Cadrage initial post-livraison sprint nocturne. |
