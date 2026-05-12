# Audit Sécurité & Résilience — OIF Emploi Jeunes
**Date** : 12 mai 2026  
**Périmètre** : Sprint « Import intelligent + Analyses IA »  
**Fichiers audités** : `lib/imports/`, `lib/analyses-indicateurs/`, `components/imports/`, `components/realisations/`, `app/api/imports/`, `supabase/migrations/`

---

## Résumé exécutif

L'architecture globale est solide. Les mécanismes de sécurité critiques (authentification, RLS, XSS, confidentialité clé API) sont en place. Deux corrections ont été apportées : un bug bloquant empêchant l'import des fichiers `.xlsm` des coordonnateurs OIF, et l'absence de rate-limit sur la génération IA (risque de coût API).

Le système de backup/rollback est **entièrement implémenté** — migration SQL, Server Action, et UI.

---

## Phase 0 — Backup / Rollback

**Existait : OUI — entièrement implémenté**

### Ce qui est en place

| Composant | Fichier | Statut |
|---|---|---|
| Table `import_sessions` | `supabase/migrations/20260512100001_import_sessions_rollback.sql` | ✅ Migration créée |
| Colonne `beneficiaires.import_session_id` | Idem (ALTER TABLE) | ✅ |
| RLS sur `import_sessions` | Idem | ✅ |
| Server Action `annulerImportSession()` | `lib/imports/import-beneficiaires.ts` L.725 | ✅ Avec contrôle rôle + expiration 30j |
| Intégration dans le pipeline | `importerBeneficiairesExcel()` L.132-152 | ✅ Tag `import_session_id` sur chaque bénéficiaire |
| UI rollback | `components/imports/dialogue-rapport-import-enrichi.tsx` L.63-148 | ✅ Bouton "Annuler cet import" + date expiration |
| Types | `lib/imports/types.ts` L.103-124 | ✅ `import_session_id`, `rollback_expire_at`, `ResultatRollbackImport` |

### Comportement du rollback

- **Fenêtre** : 30 jours après l'import
- **Mécanisme** : soft-delete (`deleted_at = now()`) des bénéficiaires créés par la session
- **Sécurité** : seul le créateur OU un `admin_scs`/`super_admin` peut rollback
- **Idempotent** : la session est marquée `peut_rollback = false` après annulation
- **Limitation documentée** : les bénéficiaires _enrichis_ (doublons existants mis à jour) ne sont pas revertés automatiquement pour éviter la perte de données antérieures

---

## Phase 1 — Résultats de l'audit sécurité

### Critiques (P0)

#### ✅ RÉSOLU — Fichiers .xlsm rejetés par la route API

**Impact** : Les coordinateurs OIF envoient des fichiers `.xlsm` (Excel macro-enabled). La validation de l'extension `.endsWith('.xlsx')` rejetait systématiquement ces fichiers avec une erreur 400 avant même d'atteindre le parser.

**Correction appliquée** :
- `app/api/imports/beneficiaires/route.ts` : accepte `.xlsx`, `.xlsm`, `.xlsb` + MIME type `application/vnd.ms-excel.sheet.macroEnabled.12`
- `components/imports/zone-upload-import.tsx` : attribut `accept=` et validation client mis à jour
- Texte d'aide UI mis à jour : « .xlsx ou .xlsm »

---

### Importantes (P1)

#### ✅ RÉSOLU — Absence de rate limit sur la génération IA

**Impact** : Un super_admin pouvait appeler `genererAnalyseIndicateur` à volonté, générant un coût API illimité (chaque génération ≈ 1 500 tokens Claude Opus-4.6).

**Correction appliquée** dans `lib/analyses-indicateurs/server-actions.ts` :
```typescript
// Rate-limit : max 10 générations par heure et par super_admin
const { count: generationsRecentes } = await supabaseRl
  .from('analyses_indicateurs')
  .select('*', { count: 'exact', head: true })
  .eq('created_by', utilisateur.user_id)
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

if ((generationsRecentes ?? 0) >= 10) {
  throw new Error('Limite atteinte : 10 générations IA par heure. Réessayez dans quelques minutes.');
}
```

---

### Conformes — Points vérifiés sans problème

#### ✅ XSS — MarkdownSimple renderer

`components/realisations/bloc-analytique-ia.tsx` (L.245-258) :
- `escapeHtml()` échappe `< > & " '` **avant** l'injection HTML
- `formatInline()` applique `escapeHtml()` en premier, puis ajoute les balises `<strong>`/`<em>`
- `dangerouslySetInnerHTML` ne reçoit que du HTML généré à partir du texte échappé ✅

#### ✅ Clé API Anthropic — confinée côté serveur

- `process.env.ANTHROPIC_API_KEY` uniquement dans `lib/analyses-indicateurs/server-actions.ts` (marqué `'use server'`)
- Jamais transmis au bundle client ✅

#### ✅ Autorisation imports — contrôle rôle côté serveur

`importerBeneficiairesExcel()` L.101-110 :
```typescript
const utilisateur = await getCurrentUtilisateur();
if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
  return { status: 'erreur_droits', ... };
}
```
Double vérification : `requireUtilisateurValide()` dans la route API + `getCurrentUtilisateur()` dans la Server Action ✅

#### ✅ Autorisation analyses IA — super_admin uniquement

`exigerSuperAdmin()` appelé au début de chaque Server Action (genérer/publier/modifier/supprimer) ✅

#### ✅ Limite de taille fichier

- Route API : 10 MB (L.47)
- Server Action : 5 MB (L.112) — double garde ✅

#### ✅ Validation MIME type

Route API vérifie l'extension + MIME type côté serveur (après correction : xlsx + xlsm) ✅

#### ✅ RLS Supabase — `user_id` vs `id`

Migration `20260511200001_fix_rls_analyses_indicateurs.sql` corrige le bug `u.id = auth.uid()` → `u.user_id = auth.uid()` sur toutes les policies `analyses_indicateurs` ✅

#### ✅ RLS `import_sessions`

Policies utilisent `created_by = auth.uid()` (colonne qui référence `auth.users.id` directement) ✅

#### ✅ FK `created_by` / `published_by`

Server Actions analyses IA utilisent `utilisateur.user_id` (auth UUID) pour les colonnes FK vers `auth.users(id)` ✅

---

### Mineures (P2)

#### ℹ️ Import non atomique (par conception)

Le pipeline traite les lignes une par une (boucle `for`). En cas d'erreur réseau en cours d'import, seule une partie des lignes peut être insérée. C'est un choix de conception documenté — le rapport final indique exactement quelles lignes ont été insérées, et le rollback de session permet d'annuler le tout.

**Recommandation** : acceptable en l'état grâce au rollback. Pour une atomicité totale, on pourrait utiliser une RPC Supabase transactionnelle, mais la complexité n'est pas justifiée ici.

#### ℹ️ `any` casts sur `import_sessions` / `beneficiaires.import_session_id`

Ces colonnes utilisent `as any` car les types TypeScript générés par Supabase ne sont pas encore régénérés après les migrations récentes. Après application des migrations et exécution de `supabase gen types typescript`, ces casts pourront être supprimés.

---

## Phase 2 — Corrections appliquées

| # | Fichier | Correction |
|---|---|---|
| 1 | `app/api/imports/beneficiaires/route.ts` | Accepte `.xlsm` (extension + MIME type) |
| 2 | `components/imports/zone-upload-import.tsx` | Validation client + `accept=` + texte UI |
| 3 | `lib/analyses-indicateurs/server-actions.ts` | Rate limit 10 générations/heure/user |

---

## Phase 3 — Recommandations post-test

1. **Appliquer les migrations** via le Management API script :
   - `20260511200001_fix_rls_analyses_indicateurs.sql`
   - `20260511300001_clean_resumes_analyses.sql`
   - `20260512100001_import_sessions_rollback.sql`

2. **Régénérer les types TypeScript Supabase** après migrations :
   ```bash
   npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/database.types.ts
   ```
   Ceci supprimera les `as any` temporaires sur `import_session_id`.

3. **Test d'import du fichier P6** — après application des migrations, tester le fichier `.xlsm` sur `/imports`. Résultats attendus :
   - 0 rejetées (Guinée → GIN grâce à la normalisation des accents)
   - ~49 incomplètes (acceptées, campagne de collecte pour domaine/modalité/consentement)
   - 2 doublons email (lignes 45 et 56)

---

## Statut final

**Prêt pour test utilisateur : OUI**

Les deux corrections critiques sont appliquées. Le système de backup/rollback est opérationnel (sous réserve d'application de la migration SQL). La plateforme peut absorber les fichiers `.xlsm` des coordonnateurs OIF.
