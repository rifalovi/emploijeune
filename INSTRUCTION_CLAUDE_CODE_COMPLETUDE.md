# Instruction Claude Code — Complétude des données & corrections complémentaires

**Branche de travail** : `main`
**Projet Supabase** : `gflragycnsaeqppgnfna`
**Date d'émission** : 30 mai 2026
**Émetteur** : VIGNON (rifalovi@gmail.com)
**Contexte session précédente** : voir `DIAGNOSTIC_TRANCHE_AGE.md` à la racine du repo.

---

## 1. Contexte et objectifs

La plateforme EMPLOIJEUNE a **5 531 bénéficiaires** en base avec **98,5% de complétude tranche d'âge** — résultat très propre. Le diagnostic SQL exécuté le 30/05/2026 (Phase 1, désormais COMPLÈTE) a révélé que la seule vraie anomalie de qualité est concentrée sur **128 bénéficiaires avec `pays_code = 'ZZZ'`** (code de repli quand le pays source n'a pas pu être résolu à l'import).

État des chantiers :

- **Tranche d'âge** : 98,5% complétude globale. 83 lignes manquantes au total. Aucun bug d'import — chiffres alignés avec le fichier source.
- **Pays `ZZZ`** : 128 bénéficiaires concentrent 60% du gap tranche d'âge ET 100% du gap pays significatif. **Vraie priorité de remédiation** (voir Phase 2.4).
- **Pays `NULL` réel** : seulement 4 lignes. Faisable de rendre `pays_code` NOT NULL après correction.
- **Côte d'Ivoire dédoublée** : 258 lignes sur le code `CIV` unique — pas de variante en base. `normaliserPourComparaison` fait son travail. Tâche 2.1 devient préventive (à vérifier seulement).
- **Limites d'import** : passée à 50 000 lignes (commits déjà poussés) — à valider sur fichier réel.
- **Migration `20260530000001`** : corrige le calcul de A5 (taux d'insertion). À vérifier après application.

Trois objectifs de cette mission :

1. ~~**Mesurer**~~ ✅ Fait — résultats disponibles dans la conversation et dans `DIAGNOSTIC_TRANCHE_AGE.md`.
2. **Corriger rétroactivement** les 128 ZZZ + 4 NULL pays (Phase 2).
3. **Prévenir** les nouveaux gaps : renforcer la validation pays à l'import, ajouter un dashboard de qualité (Phases 3 et 4).

Chaque tâche est documentée pédagogiquement : **pourquoi** elle existe, **où** elle se branche dans le code, **comment** on la teste.

---

## 2. Pré-requis

Avant de commencer, vérifier :

1. Working tree propre : `git status` → `nothing to commit`.
2. Migration `20260530000001_fix_vitrine_taux_indicateurs.sql` appliquée sur Supabase. Si non, l'appliquer en premier (Studio SQL Editor).
3. Variables d'environnement à jour : `ANTHROPIC_API_KEY` valide dans `.env.local` ET Vercel (sinon l'assistant IA renverra 401).
4. Le fichier `DIAGNOSTIC_TRANCHE_AGE.md` à la racine du repo a été lu.

---

## 3. PHASE 1 — Mesurer le gap réel en production

### Tâche 1.1 — Exécuter la requête de diagnostic ✅ COMPLÈTE

**Statut** : exécutée le 30/05/2026 sur Supabase prod (`gflragycnsaeqppgnfna`).

**Résultat synthétique** :

| Niveau | Constat |
|---|---|
| GLOBAL | 5 531 bénéficiaires, 5 448 avec tranche → **98,5%** |
| PAYS pire | `ZZZ` à 60,9% (128 lignes — 50 sans tranche) |
| PAYS pire (réel) | Maurice à 97,3% |
| PROJET pire | `PROJ_A14` à 98,3% (4 626 lignes, 78 manquants) |
| Pays à 100% | 35 sur 46 |

**Conclusion** : pas de bug d'import général. Le gap est concentré sur les 128 ZZZ → traité en Phase 2.4.

### Tâche 1.2 — Étendre le diagnostic à d'autres champs critiques

**Pourquoi** : la tranche d'âge n'est pas le seul champ qui peut faire défaut. On veut un panorama qualité.

**Où** : nouveau fichier `scripts/diagnostic_completude.sql` à versionner.

**Comment** : adapter la requête de 1.1 pour couvrir `sexe`, `pays_code`, `tranche_age_declaree`, `annee_appui`, `domaine_formation_code`, `projet_code`. Une CTE par champ, union all final, tri par `pct_complete ASC`.

**Critère d'acceptation** : un seul script SQL qui, exécuté, retourne un rapport "qualité des données" couvrant les 6 champs ci-dessus.

---

## 4. PHASE 2 — Corrections rétroactives en base

### Tâche 2.1 — Fusionner les variantes `Côte d'Ivoire`

**Pourquoi** : les deux apostrophes (`'` U+0027 et `'` U+2019) produisent deux entrées pays distinctes — les agrégations par pays sont faussées. À l'import, `normaliserPourComparaison` (`lib/imports/smart-mapper.ts:192`) les unifie déjà — mais les données historiques contiennent peut-être les deux variantes.

**Où** : nouvelle migration `supabase/migrations/20260531000001_fusion_cote_ivoire.sql`.

**Comment** :

```sql
-- 1. Identifier le code canonique. Par convention : apostrophe droite (ASCII).
-- 2. Migrer les bénéficiaires/structures qui pointent vers la variante.
-- 3. Supprimer la variante orpheline du référentiel pays.
-- 4. ON CONFLICT pas applicable car on UPDATE — gérer la duplication par MERGE
--    si la BDD a unique(projet_code, pays_code, sexe, tranche_age).
```

Concept-clé : **toujours faire la migration dans une transaction**, vérifier le nombre de lignes modifiées (`GET DIAGNOSTICS`), logger dans `import_sessions` ou un log dédié pour traçabilité.

**Critère d'acceptation** : après application, `SELECT DISTINCT libelle FROM pays_oif WHERE libelle ILIKE 'côte%';` ne retourne qu'une seule ligne.

### Tâche 2.2 — Backfill tranche d'âge depuis date de naissance (si disponible)

**Pourquoi** : si la table `beneficiaires` (ou un import historique) contient une `date_naissance` mais pas de `tranche_age_declaree`, on peut déduire automatiquement. Frontière OIF : Jeune = 18-34 ans, Adulte = 35+.

**Où** : 
- Vérifier d'abord si `date_naissance` existe : `\d public.beneficiaires` ou regarder `lib/supabase/database.types.ts`.
- Si oui, créer la migration `supabase/migrations/20260531000002_backfill_tranche_age.sql`.

**Comment** :

```sql
UPDATE public.beneficiaires
SET tranche_age_declaree = CASE
  WHEN EXTRACT(YEAR FROM age(annee_reference, date_naissance)) BETWEEN 18 AND 34 THEN 'Jeune'
  WHEN EXTRACT(YEAR FROM age(annee_reference, date_naissance)) >= 35 THEN 'Adulte'
  ELSE NULL
END
WHERE tranche_age_declaree IS NULL
  AND date_naissance IS NOT NULL;
```

Concept : utiliser `annee_appui` comme référence temporelle (pas `NOW()`) — sinon un bénéficiaire de 30 ans appuyé en 2020 deviendrait Adulte au moment du backfill en 2026, alors qu'il était Jeune à la date d'appui.

**Critère d'acceptation** : `SELECT COUNT(*) FROM beneficiaires WHERE tranche_age_declaree IS NULL` diminue après application.

**Confirmé** : la colonne `date_naissance: string | null` existe bien dans `lib/supabase/database.types.ts` sur la table `beneficiaires`. La tâche est faisable.

### Tâche 2.0 (PRÉREQUIS) — Créer la table `alertes_qualite` ✅ COMPLÈTE

**Statut** : migration appliquée le 31/05/2026 sur Supabase prod (`gflragycnsaeqppgnfna`). Table vide, prête à recevoir les alertes des phases 2.3 et 2.4.

**Pourquoi** : la table physique `alertes_qualite` n'existait pas. Le KPI affiché dans le dashboard admin était calculé dynamiquement par la RPC `get_kpis_dashboard_admin_scs()` (compteurs `date_naissance IS NULL`, `consentement_date IS NULL`, etc.) — un nombre agrégé, sans détail par ligne, sans workflow de résolution. Pour les phases 2.3 (pays NULL) et 2.4 (pays ZZZ), il faut une vraie table qui stocke chaque anomalie individuellement avec un workflow de résolution.

**Décision validée par VIGNON le 31/05/2026** : table physique avec workflow complet (ouvert → en_cours → resolu | ignore).

**Où** : `supabase/migrations/20260531000000_create_alertes_qualite.sql`.

**Schéma final appliqué** (4 améliorations par rapport au brouillon initial) :

```sql
CREATE TABLE public.alertes_qualite (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,                                -- 'pays_zzz' | 'pays_null' | 'tranche_age_null' | ...
  severite        TEXT NOT NULL DEFAULT 'avertissement',        -- 'info' | 'avertissement' | 'critique'
  statut          TEXT NOT NULL DEFAULT 'ouvert',               -- 'ouvert' | 'en_cours' | 'resolu' | 'ignore'
  beneficiaire_id UUID REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  structure_id    UUID REFERENCES public.structures(id)    ON DELETE CASCADE,
  projet_code     TEXT,
  message         TEXT NOT NULL,
  assigne_a       UUID REFERENCES auth.users(id),
  resolu_par      UUID REFERENCES auth.users(id),
  resolu_le       TIMESTAMPTZ,
  note_resolution TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_alertes_statut   CHECK (statut   IN ('ouvert','en_cours','resolu','ignore')),
  CONSTRAINT chk_alertes_severite CHECK (severite IN ('info','avertissement','critique')),
  CONSTRAINT chk_alertes_cible CHECK (
    NOT (beneficiaire_id IS NOT NULL AND structure_id IS NOT NULL)
  )
);

-- Unicite via index partiels (les NULL ne participent pas).
CREATE UNIQUE INDEX uq_alertes_qualite_benef  ON public.alertes_qualite (type, beneficiaire_id) WHERE beneficiaire_id IS NOT NULL;
CREATE UNIQUE INDEX uq_alertes_qualite_struct ON public.alertes_qualite (type, structure_id)    WHERE structure_id IS NOT NULL;

CREATE INDEX idx_alertes_qualite_statut       ON public.alertes_qualite (statut);
CREATE INDEX idx_alertes_qualite_type         ON public.alertes_qualite (type);
CREATE INDEX idx_alertes_qualite_beneficiaire ON public.alertes_qualite (beneficiaire_id) WHERE beneficiaire_id IS NOT NULL;
CREATE INDEX idx_alertes_qualite_structure    ON public.alertes_qualite (structure_id)    WHERE structure_id IS NOT NULL;

-- Trigger : reutilise tg_set_updated_at() existante (pas de nouvelle fonction).
CREATE TRIGGER trg_alertes_qualite_upd
  BEFORE UPDATE ON public.alertes_qualite
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS : lecture pour tous les authentifies, ecriture via is_admin_scs() (inclut super_admin).
ALTER TABLE public.alertes_qualite ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertes_qualite_select ON public.alertes_qualite FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY alertes_qualite_admin  ON public.alertes_qualite FOR ALL TO authenticated
  USING  (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

GRANT SELECT ON public.alertes_qualite TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.alertes_qualite TO authenticated;
```

**Améliorations appliquées vs brouillon initial** :

| Point | Brouillon | Final | Raison |
|---|---|---|---|
| Unicite cible | `UNIQUE (type, beneficiaire_id)` (contrainte table) | Index partiel `WHERE NOT NULL` | Les UNIQUE table-level incluent les NULL → faux conflits sur alertes globales |
| CHECK cible | 3 branches OR explicites | `NOT (both NOT NULL)` | Plus simple, meme semantique (interdit d'avoir les deux FK remplies) |
| Trigger updated_at | Nouvelle fonction `tg_alertes_qualite_updated_at()` | Reutilise `tg_set_updated_at()` existante | Evite la duplication (fonction identique deja utilisee sur 8+ tables) |
| RLS ecriture | Sous-requete `EXISTS (SELECT 1 FROM utilisateurs WHERE auth_user_id = ...)` | `public.is_admin_scs()` | Suit le pattern existant du projet ; `is_admin_scs()` inclut deja super_admin ; note : la colonne s'appelle `user_id` et non `auth_user_id` |

**Adapter** ensuite la RPC `get_kpis_dashboard_admin_scs()` pour qu'elle compte depuis cette table plutot qu'a la volee.

**Critere d'acceptation** : ✅ la table existe, RLS active, `SELECT COUNT(*) FROM alertes_qualite` = 0.

### Tâche 2.3 — Identifier et marquer les pays vides

**Pourquoi** : la requête phase 1 a confirmé **4 lignes** avec `pays_code IS NULL` (toutes avec tranche d'âge renseignée). Faible volume mais critique pour les agrégations géographiques.

**Où** : nouvelle migration `supabase/migrations/20260531000003_alerte_pays_vide.sql` + ajout d'une alerte dans `/admin/alertes-qualite`.

**Comment** :
1. **Pas de UPDATE en masse** — un pays vide est une donnée manquante, pas une erreur à corriger automatiquement.
2. Insérer une **alerte qualité** par bénéficiaire concerné dans la table `alertes_qualite` (créée en Tâche 2.0) :

```sql
INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
SELECT 'pays_null', 'avertissement', b.id, b.projet_code,
       'Pays manquant — renseigner via /admin/alertes-qualite'
FROM public.beneficiaires b
WHERE b.pays_code IS NULL AND b.deleted_at IS NULL
ON CONFLICT (type, beneficiaire_id) DO NOTHING;
```

3. L'admin pourra corriger ligne par ligne via l'UI à étendre (formulaire de correction de pays + bouton « Marquer résolu »).

**Critère d'acceptation** : `/admin/alertes-qualite` affiche 4 alertes `pays_null` (compte exact de la phase 1).

### Tâche 2.4 — Résoudre les bénéficiaires avec `pays_code = 'ZZZ'`

**Pourquoi** : le diagnostic phase 1 a révélé **128 bénéficiaires** avec `pays_code = 'ZZZ'` — c'est-à-dire **60% de tous les bénéficiaires sans tranche d'âge** de la plateforme et **100% du gap pays significatif**. `ZZZ` est un code de repli utilisé par le smart-mapper quand le pays source n'a pas pu être résolu (libellé non standard, vide, ou inconnu du référentiel `pays_oif`). C'est la **seule vraie anomalie de qualité de données** à corriger.

**Constat précis (résultat phase 1)** :

| Indicateur | Valeur |
|---|---|
| Bénéficiaires `pays_code = 'ZZZ'` | 128 |
| Dont sans tranche d'âge | 50 (39,1% du sous-groupe) |
| Bénéficiaires `pays_code IS NULL` (vrai NULL) | 4 |
| Total bénéficiaires en base | 5 531 |
| Complétude globale tranche d'âge | 98,5% |

**Conclusion** : aucun bug d'import général. La chaîne `smart-mapper` fonctionne pour tous les autres pays (35 pays à 100% de complétude). Le problème est concentré sur les imports historiques où le libellé pays source n'a pas matché.

**Confirmé côté schéma BDD** :
- `beneficiaires.import_session_id` existe et a une FK vers `import_sessions(id) ON DELETE SET NULL`. La requête de listing avec contexte d'import est possible.
- `alertes_qualite` est créée en Phase 2.0 (prérequis).

**Où** :
- Nouvelle UI : `app/(dashboard)/super-admin/nettoyage-donnees/pays-inconnus/page.tsx`.
- Nouvelle RPC : `corriger_pays_beneficiaire(beneficiaire_id, nouveau_pays_code)` dans la migration.
- Migration : `supabase/migrations/20260531000005_audit_pays_zzz.sql` qui (a) crée la RPC d'audit, (b) génère une alerte qualité par bénéficiaire `ZZZ` dans la table créée en 2.0.

**Comment** :

1. **Requête de listing avec contexte d'origine** :

```sql
SELECT
  b.id,
  b.prenoms,
  b.nom,
  b.sexe,
  b.tranche_age_declaree,
  b.projet_code,
  b.annee_appui,
  i.nom_fichier        AS fichier_origine,
  i.created_at         AS date_import,
  i.created_by         AS importeur
FROM public.beneficiaires b
LEFT JOIN public.import_sessions i ON b.import_session_id = i.id
WHERE b.deleted_at IS NULL
  AND b.pays_code = 'ZZZ'
ORDER BY b.projet_code, i.created_at;
```

2. **UI tableau** dans `pays-inconnus/page.tsx` :
   - Colonnes : Nom, Projet, Année d'appui, Fichier source, Date import, Importeur, Action.
   - Action = dropdown `Select` peuplé depuis `pays_oif` (codes ISO-3 + libellés) + bouton « Appliquer ».
   - Au submit : appel server action `corrigerPaysBeneficiaire(id, code)` qui appelle la RPC.
   - Compteur en haut : « 128 bénéficiaires à résoudre — 0 corrigés ». Décrémenter à chaque action.

3. **Server action** dans `lib/super-admin/server-actions.ts` :
   - Vérifier auth + rôle `super_admin`.
   - Vérifier que `nouveau_pays_code` est un code valide de `pays_oif`.
   - Appeler RPC.
   - Logger dans `audit_log` (table existante — vérifier).
   - `revalidatePath('/super-admin/nettoyage-donnees/pays-inconnus')`.

4. **RPC `corriger_pays_beneficiaire`** :

```sql
CREATE OR REPLACE FUNCTION public.corriger_pays_beneficiaire(
  p_beneficiaire_id UUID,
  p_nouveau_pays_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pays_existe BOOLEAN;
BEGIN
  -- Vérifier que le nouveau code existe dans le référentiel
  SELECT EXISTS(SELECT 1 FROM public.pays_oif WHERE code = p_nouveau_pays_code AND code <> 'ZZZ')
  INTO v_pays_existe;

  IF NOT v_pays_existe THEN
    RAISE EXCEPTION 'Code pays % invalide ou non autorisé (ZZZ refusé)', p_nouveau_pays_code;
  END IF;

  UPDATE public.beneficiaires
  SET pays_code = p_nouveau_pays_code,
      updated_at = NOW()
  WHERE id = p_beneficiaire_id
    AND pays_code = 'ZZZ'   -- garde-fou : ne corrige QUE les ZZZ
    AND deleted_at IS NULL;

  -- Marquer l'alerte qualité comme résolue (si elle existe)
  UPDATE public.alertes_qualite
  SET statut = 'resolu',
      resolu_par = auth.uid(),
      resolu_le = NOW(),
      note_resolution = 'Pays corrigé en ' || p_nouveau_pays_code
  WHERE beneficiaire_id = p_beneficiaire_id
    AND type = 'pays_zzz'
    AND statut = 'ouvert';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.corriger_pays_beneficiaire(UUID, TEXT) TO authenticated;
```

5. **Génération automatique des alertes qualité** (idempotent) dans la migration, en s'appuyant sur la table créée en Phase 2.0 :

```sql
INSERT INTO public.alertes_qualite (
  type, severite, beneficiaire_id, message, projet_code, created_at
)
SELECT
  'pays_zzz',
  'avertissement',
  b.id,
  'Pays non résolu à l''import (code ZZZ). Correction manuelle requise.',
  b.projet_code,
  NOW()
FROM public.beneficiaires b
WHERE b.pays_code = 'ZZZ'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.alertes_qualite a
    WHERE a.beneficiaire_id = b.id AND a.type = 'pays_zzz'
  );
```

**Critère d'acceptation** :
- `SELECT COUNT(*) FROM beneficiaires WHERE pays_code = 'ZZZ' AND deleted_at IS NULL` < 10 après une session de correction.
- 128 alertes qualité créées (vérifiable dans `/admin/alertes-qualite`).
- UI fonctionnelle avec correction réussie sur au moins 5 lignes de test.

**Précaution** :
- La correction n'est PAS automatique — chaque ligne nécessite un humain qui consulte le fichier source pour deviner le pays réel.
- Si le fichier source est introuvable, l'admin peut laisser ZZZ et marquer l'alerte « Résolution impossible ».

---

## 5. PHASE 3 — Renforcement préventif

### Tâche 3.1 — Étendre les alias de tranche d'âge

**Pourquoi** : `TRANCHE_AGE_ALIASES` (`lib/imports/smart-mapper.ts:412`) liste 11 variantes. Le diagnostic de la phase 1 peut révéler d'autres formats utilisés en pratique (ex. `"18-35"`, `"plus de 35"`, etc.).

**Où** : `lib/imports/smart-mapper.ts:412`.

**Comment** : pour chaque nouvelle variante détectée dans le rapport phase 1 (chercher les `tranche_age_declaree` NULL dont la valeur source était non vide), ajouter l'alias correspondant. Toujours tester avec `normaliserPourComparaison` mentalement avant d'ajouter.

**Critère d'acceptation** : tests unitaires correspondants dans `tests/unit/` (créer `smart-mapper-tranche-age.spec.ts` s'il n'existe pas).

### Tâche 3.2 — Rendre `pays_code` obligatoire à l'import (avec rapport d'erreur clair)

**Pourquoi** : aujourd'hui `pays_code` est nullable (`20260514100001_pays_code_nullable_beneficiaires.sql`). C'est pratique pour la souplesse mais coûteux en qualité de données.

**Où** : 
- Code import : `lib/imports/import-beneficiaires.ts` (ligne ~440, fonction de validation).
- Migration : `supabase/migrations/20260531000004_pays_code_not_null.sql` (réactive le NOT NULL, **après** correction des données existantes via 2.3).

**Comment** :
1. **D'abord** s'assurer que la base n'a plus de `pays_code = NULL` (via 2.3 + correction manuelle admin).
2. Migration `ALTER TABLE ... ALTER COLUMN pays_code SET NOT NULL`.
3. Côté import, refuser la ligne avec message d'erreur explicite : « Pays manquant — ligne ignorée. Renseignez le pays dans la colonne `Pays de Provenance`. »

**Critère d'acceptation** : un fichier de test avec une ligne sans pays produit une erreur claire à l'import, pas un crash.

**Attention** : cette tâche est **bloquante** pour les utilisateurs existants. À discuter avec VIGNON avant exécution si > 5% des bénéficiaires sont concernés.

### Tâche 3.3 — Normaliser les apostrophes à la lecture

**Pourquoi** : on a `normaliserPourComparaison` qui unifie, mais on garde la valeur source telle quelle pour l'affichage. Pour les libellés de pays affichés en UI, on devrait avoir UNE seule version canonique.

**Où** : `lib/imports/smart-mapper.ts` — fonction `normaliserPays` ou équivalent (à créer si absent).

**Comment** : avant insertion en BDD, remplacer `'` (U+2019) par `'` (U+0027) dans les libellés de pays. Idempotent.

**Critère d'acceptation** : aucune nouvelle ligne ne peut entrer avec l'apostrophe courbe dans `pays_code` ou `pays_libelle`.

---

## 6. PHASE 4 — Visibilité (dashboard complétude)

### Tâche 4.1 — Dashboard « Qualité des données »

**Pourquoi** : la qualité ne s'améliore que si elle est mesurée en continu. Aujourd'hui le seul moyen de connaître la complétude est de lancer une requête SQL ad hoc.

**Où** : nouvelle page `/admin/qualite-donnees` ou extension de `/admin/alertes-qualite` ou `/super-admin/nettoyage-donnees`.

**Comment** :
1. Créer une RPC `get_indicateurs_qualite_donnees_v1()` (style `get_indicateurs_vitrine_v1`) qui retourne pour chaque champ critique : `total`, `complets`, `pct_complete`.
2. Page React qui affiche les KPI sous forme de cartes (composant `CompteurCarte` ou `Card`).
3. Bouton « Détail par projet » qui ouvre un drawer avec le breakdown.

**Composants existants à réutiliser** : `Card`, `CardContent` de `components/ui/`, le pattern de `KpiCompteurs` dans `app/page.tsx`.

**Critère d'acceptation** : un admin peut, en 1 clic depuis le dashboard, voir le % de complétude par champ et identifier les projets/pays défaillants.

### Tâche 4.2 — Alerte automatique si chute de complétude

**Pourquoi** : après un import massif raté, on doit être alerté avant qu'un rapport public soit généré avec des trous.

**Où** : 
- Trigger SQL sur `beneficiaires` après chaque import.
- Insertion dans `alertes_qualite` si `pct_complete < 80%` pour un champ donné.

**Comment** : hook après chaque session d'import. Ne pas faire un trigger ligne à ligne (trop coûteux) — plutôt un appel manuel après commit d'un import.

**Critère d'acceptation** : un import qui dégrade la complétude génère automatiquement une alerte visible dans `/admin/alertes-qualite`.

---

## 7. PHASE 5 — Vérifications de régression

### Tâche 5.1 — Tester la migration A5

**Pourquoi** : confirmer que la correction du taux d'insertion (commit précédent) fonctionne en condition réelle.

**Où** : page d'accueil `/accueil`.

**Comment** :
1. Saisir manuellement, via `/super-admin/analyses-indicateurs`, un couple `(numerateur=300, denominateur=1500)` pour A5.
2. Recharger la page d'accueil.
3. Vérifier que la carte A5 affiche `20,0 %` (et non plus 1100 ou similaire).

**Critère d'acceptation** : carte vitrine A5 affiche un pourcentage formé `XX,X %`.

### Tâche 5.2 — Tester la limite d'import 50 000

**Pourquoi** : valider qu'un fichier de 6 000+ lignes passe désormais.

**Où** : `/imports`.

**Comment** : uploader le fichier `Base de sondage_EmploiJeune_Global_230426_V2 (2).xlsm` (5 619 lignes). Vérifier que l'import est accepté, pas refusé.

**Critère d'acceptation** : message « Importé(s) » avec le nombre de lignes réel.

### Tâche 5.3 — Tester le fallback IA

**Pourquoi** : valider que le message d'erreur lisible s'affiche en lieu et place du JSON brut.

**Où** : `/assistant-ia`.

**Comment** : 
- Si la clé API a été mise à jour : envoyer un message, doit fonctionner.
- Si la clé est encore invalide : envoyer un message, doit afficher « Service IA momentanément indisponible : la configuration côté serveur doit être mise à jour. Contactez un super-administrateur. »

**Critère d'acceptation** : aucun JSON brut visible côté utilisateur en cas d'erreur.

---

## 7bis. PHASE 7 — Maintenance plateforme (purge + recalcul) — RÉSERVÉ SUPER_ADMIN

**Contexte (validé par VIGNON le 31/05/2026)** : disposer d'un outil unique pour gérer trois scénarios de récupération :

1. La base est corrompue ou contient des données erronées non récupérables → vider proprement.
2. Réimport d'une base actualisée ou d'un backup → enchaîner avec les imports standards.
3. Forcer le recalcul de tous les indicateurs pour que la vitrine, le dashboard et les analyses reflètent l'état actuel de la base.

**Précautions absolues** : ce module manipule des opérations destructives. Toute migration ou code lié doit être protégé par RLS `super_admin` UNIQUEMENT, jamais `admin_scs`. Aucun raccourci.

### Tâche 7.1 — RPC de purge des données métier

**Pourquoi** : centraliser la purge dans une seule fonction SQL plutôt que d'appeler plusieurs TRUNCATE dispersés. Une RPC est testable, atomique, et journalisable.

**Où** : `supabase/migrations/20260531000010_maintenance_purge_recalcul.sql`.

**Périmètre (validé)** : 
- **VIDÉ** : `beneficiaires`, `structures`, `valeurs_indicateurs_saisies`, `alertes_qualite`, `import_sessions`.
- **PRÉSERVÉ** : `utilisateurs`, `auth.users`, `projets`, `pays_oif`, `config_vitrine_indicateurs`, et toutes les tables de configuration/référentiel.

**RPC** :

```sql
CREATE OR REPLACE FUNCTION public.purger_donnees_metier_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compteurs JSONB;
  v_uid UUID := auth.uid();
BEGIN
  /* Garde-fou serveur : seuls les super_admin peuvent appeler.
     Même si la UI le bloque, on protège aussi côté BDD. */
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action réservée aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  /* Snapshot des effectifs AVANT purge — journalisation. */
  SELECT jsonb_build_object(
    'beneficiaires',     (SELECT COUNT(*) FROM public.beneficiaires WHERE deleted_at IS NULL),
    'structures',        (SELECT COUNT(*) FROM public.structures WHERE deleted_at IS NULL),
    'indicateurs_saisis',(SELECT COUNT(*) FROM public.valeurs_indicateurs_saisies),
    'alertes_qualite',   (SELECT COUNT(*) FROM public.alertes_qualite),
    'import_sessions',   (SELECT COUNT(*) FROM public.import_sessions)
  ) INTO v_compteurs;

  /* Purge dans une transaction. Ordre important pour respecter les FK :
     1. alertes_qualite (référence beneficiaires/structures)
     2. valeurs_indicateurs_saisies (autonome)
     3. import_sessions (référencée par beneficiaires)
        → on garde l'ordre TRUNCATE CASCADE qui résout les FK
     4. beneficiaires (FK vers structures et import_sessions)
     5. structures */
  TRUNCATE TABLE public.alertes_qualite              RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.valeurs_indicateurs_saisies  RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.beneficiaires                RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.structures                   RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.import_sessions              RESTART IDENTITY CASCADE;

  /* Audit log — trace qui a purgé quand et avec quel effectif. */
  INSERT INTO public.audit_log (action, acteur_id, payload, created_at)
  VALUES (
    'purge_donnees_metier',
    v_uid,
    jsonb_build_object('effectifs_avant', v_compteurs, 'horodatage', NOW()),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'effectifs_avant', v_compteurs,
    'message', 'Base vidée. Réimportez vos données puis lancez le recalcul.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purger_donnees_metier_v1() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.purger_donnees_metier_v1() TO authenticated;
/* La RPC se protège elle-même via is_super_admin() — le GRANT n'autorise
   que l'invocation, pas l'exécution effective si le rôle est insuffisant. */
```

**Si `audit_log` n'existe pas** : la créer dans la même migration (table simple : id, action, acteur_id, payload jsonb, created_at). Vérifier d'abord son existence dans `lib/supabase/database.types.ts`.

### Tâche 7.2 — RPC de recalcul des indicateurs

**Pourquoi** : après purge + réimport, les RPC d'agrégation (`get_indicateurs_vitrine_v1`, `get_kpis_dashboard_admin_scs`, etc.) calculent à la volée. Mais certaines vues matérialisées ou caches peuvent persister. Cette RPC garantit un état cohérent.

**Où** : même migration 20260531000010.

```sql
CREATE OR REPLACE FUNCTION public.recalculer_indicateurs_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultats JSONB := '{}'::JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Action réservée aux super-administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  /* 1. Si des vues matérialisées existent (à vérifier dans le repo),
        les rafraîchir ici :
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_xxx;
     2. Recalcul des alertes qualité : régénérer pays_zzz, pays_null, 
        tranche_age_null à partir de l'état actuel des bénéficiaires. */
  
  -- Reset des alertes qualité auto-générées (on garde les manuelles)
  DELETE FROM public.alertes_qualite
  WHERE type IN ('pays_zzz', 'pays_null', 'tranche_age_null');

  -- Régénération pays_zzz
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'pays_zzz', 'avertissement', b.id, b.projet_code,
         'Pays non résolu à l''import (code ZZZ). Correction manuelle requise.'
  FROM public.beneficiaires b
  WHERE b.pays_code = 'ZZZ' AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  -- Régénération pays_null
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'pays_null', 'avertissement', b.id, b.projet_code,
         'Pays manquant — renseigner.'
  FROM public.beneficiaires b
  WHERE b.pays_code IS NULL AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  -- Régénération tranche_age_null
  INSERT INTO public.alertes_qualite (type, severite, beneficiaire_id, projet_code, message)
  SELECT 'tranche_age_null', 'info', b.id, b.projet_code,
         'Tranche d''âge non renseignée.'
  FROM public.beneficiaires b
  WHERE b.tranche_age_declaree IS NULL AND b.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  /* Compteurs après recalcul, pour le retour UI */
  SELECT jsonb_build_object(
    'beneficiaires', (SELECT COUNT(*) FROM public.beneficiaires WHERE deleted_at IS NULL),
    'structures',    (SELECT COUNT(*) FROM public.structures WHERE deleted_at IS NULL),
    'alertes_generees', (SELECT COUNT(*) FROM public.alertes_qualite WHERE type IN ('pays_zzz','pays_null','tranche_age_null'))
  ) INTO v_resultats;

  /* Audit log */
  INSERT INTO public.audit_log (action, acteur_id, payload, created_at)
  VALUES ('recalcul_indicateurs', auth.uid(), v_resultats, NOW());

  RETURN jsonb_build_object('success', TRUE, 'resultats', v_resultats);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculer_indicateurs_v1() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculer_indicateurs_v1() TO authenticated;
```

### Tâche 7.3 — Page UI `/super-admin/maintenance`

**Où** : `app/(dashboard)/super-admin/maintenance/page.tsx` + `components/super-admin/maintenance-client.tsx`.

**Layout** : deux cartes côte à côte sur desktop, empilées sur mobile.

**Carte 1 — « Vider la base de données »** (rouge, signal danger) :
- Description claire des tables qui seront vidées (liste à puces).
- Tableau des effectifs actuels (compté côté serveur dans le RSC parent).
- Bouton rouge « Vider la base… » qui ouvre un modal.

**Modal de purge (3 étapes)** :
1. **Étape 1 — Lecture** : récap des tables, des effectifs, et de l'irréversibilité. Bouton « J'ai compris, continuer ».
2. **Étape 2 — Confirmation** : checkbox « Je confirme avoir lu et compris que cette action est irréversible. Aucun backup automatique n'est créé. ». Bouton « Suivant » désactivé tant que la checkbox est décochée.
3. **Étape 3 — Mot-clé** : champ texte avec placeholder « Tapez VIDER LA BASE pour confirmer ». Bouton « Vider la base » désactivé tant que la valeur exacte n'est pas saisie (comparaison stricte, casse sensible).

À la soumission : appel server action `purgerDonneesMetier()` qui invoque la RPC. Spinner pendant l'opération. Toast succès avec le récap des effectifs vidés. `revalidatePath('/super-admin/maintenance')` + `revalidatePath('/accueil')` pour reset la vitrine.

**Carte 2 — « Forcer la mise à jour des indicateurs »** (orange, signal action manuelle) :
- Description : « Recalcule toutes les agrégations (vitrine, dashboard, analyses) et régénère les alertes qualité automatiques (pays ZZZ, pays NULL, tranche d'âge manquante). À lancer après chaque réimport de données. »
- Bouton orange « Forcer la mise à jour ».

À la soumission : appel server action `recalculerIndicateurs()` qui invoque la RPC. Spinner. Toast avec le récap des compteurs + alertes générées. Invalidation cache :

```ts
revalidatePath('/', 'layout');  // invalide tout l'arbre
```

### Tâche 7.4 — Server actions

**Où** : `lib/super-admin/server-actions.ts` (ou créer si absent).

```ts
'use server';

export async function purgerDonneesMetier() {
  const utilisateur = await getCurrentUtilisateur();
  if (utilisateur?.role !== 'super_admin') {
    return { status: 'erreur', message: 'Accès refusé.' };
  }
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('purger_donnees_metier_v1');
  
  if (error) {
    return { status: 'erreur', message: error.message };
  }
  
  revalidatePath('/super-admin/maintenance');
  revalidatePath('/accueil');
  return { status: 'succes', ...data };
}

export async function recalculerIndicateurs() {
  const utilisateur = await getCurrentUtilisateur();
  if (utilisateur?.role !== 'super_admin') {
    return { status: 'erreur', message: 'Accès refusé.' };
  }
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('recalculer_indicateurs_v1');
  
  if (error) {
    return { status: 'erreur', message: error.message };
  }
  
  /* Invalidation complète du cache Next.js : vitrine, dashboard, 
     analyses, réalisations. La layer 'layout' purge tout l'arbre. */
  revalidatePath('/', 'layout');
  return { status: 'succes', ...data };
}
```

### Tâche 7.5 — Lien dans la sidebar super_admin

**Où** : `components/layout/` (composant de navigation latérale).

**Comment** : ajouter une entrée « Maintenance » dans le groupe super_admin, avec icône `AlertTriangle` (rouge atténué) pour signaler la sensibilité. Tooltip : « Purge et recalcul — accès restreint ».

### Critères d'acceptation Phase 7

1. La RPC `purger_donnees_metier_v1` refuse l'appel d'un utilisateur non-super_admin (test : se connecter en admin_scs et tenter d'appeler → erreur 42501).
2. Après purge, `SELECT COUNT(*) FROM beneficiaires` retourne 0.
3. Le modal de purge ne permet pas de cliquer le bouton final tant que les 3 étapes ne sont pas franchies (checkbox + mot-clé exact).
4. Après recalcul, les alertes auto-générées sont conformes à l'état actuel de la base.
5. Le compteur de bénéficiaires sur la page d'accueil reflète l'état actuel après purge+import+recalcul (test : purger → réimporter 100 lignes → recalculer → vitrine affiche 100).
6. Chaque appel des deux RPC laisse une trace dans `audit_log`.

---

## 8. Livrables attendus

| Livrable | Localisation | Phase |
|---|---|---|
| ~~Rapport complétude (CSV)~~ ✅ | `DIAGNOSTIC_TRANCHE_AGE.md` (résultat dans la conversation) | 1 |
| Script SQL diagnostic réutilisable | `scripts/diagnostic_completude.sql` | 1.2 |
| Migration fusion Côte d'Ivoire (vérif) | `supabase/migrations/20260531000001_fusion_cote_ivoire.sql` | 2.1 |
| Migration backfill âge (si applicable) | `supabase/migrations/20260531000002_backfill_tranche_age.sql` | 2.2 |
| Migration alertes pays NULL | `supabase/migrations/20260531000003_alerte_pays_vide.sql` | 2.3 |
| **Migration audit ZZZ + RPC correction** | `supabase/migrations/20260531000005_audit_pays_zzz.sql` | **2.4** |
| **UI résolution ZZZ** | `app/(dashboard)/super-admin/nettoyage-donnees/pays-inconnus/page.tsx` | **2.4** |
| Alias étendus tranche d'âge | `lib/imports/smart-mapper.ts` + tests | 3.1 |
| Pays NOT NULL (conditionnel) | `supabase/migrations/20260531000004_pays_code_not_null.sql` | 3.2 |
| Page Qualité des données | `app/(dashboard)/admin/qualite-donnees/page.tsx` | 4.1 |
| Tests régression (manuel) | Captures dans un commit msg ou doc dédié | 5 |
| **Migration purge + recalcul** | `supabase/migrations/20260531000010_maintenance_purge_recalcul.sql` | **7** |
| **Page Maintenance super-admin** | `app/(dashboard)/super-admin/maintenance/page.tsx` | **7** |
| **Server actions maintenance** | `lib/super-admin/server-actions.ts` | **7** |

---

## 9. Ordre d'exécution recommandé (mis à jour 31/05/2026 post-diagnostic BDD)

1. ~~**Phase 1**~~ ✅ Fait — résultats connus.
2. **Phase 5.1, 5.2, 5.3** (vérifications de régression) → 15 min, valide les corrections déjà poussées.
3. **Phase 2.0** (création table `alertes_qualite`) → **PRÉREQUIS** des phases 2.3 et 2.4. Aucune complexité.
4. **Phase 2.4** (résolution ZZZ) → **chantier principal**, c'est le vrai gain qualité (128 lignes).
5. **Phase 2.3** (alertes pays NULL) → 4 lignes seulement, rapide.
6. **Phase 2.2** (backfill âge) → `date_naissance` confirmée présente, gain de 83 lignes max.
7. **Phase 2.1** (Côte d'Ivoire) → tâche préventive, vérifier qu'aucune variante n'est en base.
8. **Phase 4.1** (dashboard qualité) → visibilité continue, motive les correcteurs ZZZ.
9. **Phase 3.3** (normalisation apostrophes) → quick win défensif.
10. ~~**Phase 3.1**~~ — non prioritaire, complétude tranche déjà à 98,5%.
11. **Phase 3.2** (NOT NULL pays) → après résolution des ZZZ + 4 NULL.
12. **Phase 4.2** (alerte auto) → finition.
13. **Phase 7** (maintenance plateforme) → **chantier indépendant**, peut être fait en parallèle ou après les phases complétude. Recommandé : après Phase 2.0 (table alertes_qualite créée).

---

## 10. Règles non négociables

- **Aucune migration appliquée sans test sur une branche** Supabase de preview (créer via `mcp__supabase__create_branch` si disponible).
- **Tous les UPDATE en masse** doivent être dans une transaction (`BEGIN ... COMMIT`) avec un compte de lignes modifiées en sortie.
- **Aucun fichier sensible** versionné : `rapports/` doit être dans `.gitignore` si les exports contiennent des données réelles.
- **Build production avant chaque push** — exécuter `npm run build` (pas seulement `npx tsc --noEmit`) avant `git push`. ESLint en mode production détecte les unused imports/vars que TypeScript laisse passer. Cas vécu : le 31/05/2026, l'import `Check` non utilisé dans `maintenance-client.tsx` a bloqué 9 déploiements Vercel consécutifs sans qu'aucun signal local ne l'indique.
- **Aucun emoji** dans les commits (cf. préférences utilisateur).
- **Messages de commit en français**, format conventionnel : `feat(scope): ...` / `fix(scope): ...` / `chore(scope): ...`.
- **Documenter chaque migration** avec un en-tête expliquant le pourquoi (concept) et le quoi (mécanique).
- **Migrations idempotentes** — toute migration qui insère des données (`INSERT`) doit utiliser `ON CONFLICT DO NOTHING` ou équivalent, pour pouvoir être ré-exécutée sans dégât. Toute migration qui ajoute du schéma (`CREATE TABLE`, `CREATE INDEX`, etc.) doit utiliser `IF NOT EXISTS`.
- **Vérification post-apply obligatoire** — après chaque migration, exécuter une requête SQL `SELECT` qui prouve que le changement est effectif (compte de lignes insérées, présence d'une nouvelle colonne, etc.). Ne JAMAIS se contenter de « migration créée et commit poussé » : une migration peut être dans le repo sans avoir tourné sur prod (cas vécu le 31/05/2026 sur la Phase 2.3 — 4 alertes pays_null qui auraient dû être créées ne l'étaient pas). Reporter le résultat de la vérif dans le message du commit ou en sortie de tool.
- **Audit régulier de l'écart repo/prod** — exécuter périodiquement `SELECT name, executed_at FROM supabase_migrations.schema_migrations ORDER BY executed_at DESC LIMIT 30` et comparer avec `ls supabase/migrations/` pour détecter toute divergence.

---

## 11. Points à clarifier auprès de VIGNON avant action

| Question | Statut | Réponse |
|---|---|---|
| 1. Rendre `pays_code` obligatoire à l'import (phase 3.2) ? | ⏳ À voir | À discuter après résolution des 128 ZZZ. Sur les 5 531 lignes, seules 4 sont vraiment NULL — donc impact très faible. |
| 2. Colonne `date_naissance` existe ? | ✅ Réponse | OUI — confirmé dans `lib/supabase/database.types.ts`. Phase 2.2 faisable. |
| 3. Format date de référence pour backfill ? | ⏳ À confirmer | Recommandé : `annee_appui` (préserve l'âge à la date d'appui, pas à la date de backfill). |
| 4. Rôle pour dashboard qualité ? | ⏳ À confirmer | Recommandé : accessible à `admin_scs` ET `super_admin` (RLS déjà configurée ainsi sur la table créée en Phase 2.0). |
| 5. Architecture alertes qualité ? | ✅ Réponse (31/05/2026) | Table physique avec workflow complet (cf. Phase 2.0). |

Questions encore ouvertes : **3** et **4** (sans bloquant pour démarrer).

---

## 12. Référentiel — fichiers et tables clés

- **Tables BDD** : `beneficiaires`, `structures`, `pays_oif`, `projets`, `valeurs_indicateurs_saisies`, `alertes_qualite`, `import_sessions`, `config_vitrine_indicateurs`.
- **Imports** : `lib/imports/parser-excel.ts`, `lib/imports/parser-excel-flexible.ts`, `lib/imports/smart-mapper.ts`, `lib/imports/import-beneficiaires.ts`, `lib/imports/import-structures.ts`.
- **Vitrine** : `app/page.tsx`, `lib/landing/queries.ts`, `lib/referentiels/indicateurs.ts`, `components/landing/cadre-commun-fan.tsx`.
- **Admin** : `app/(dashboard)/admin/`, `components/admin/`, `components/alertes-qualite/`.
- **Super-admin** : `app/(dashboard)/super-admin/`, en particulier `analyses-indicateurs` et `affichage-public`.

---

## 13. Critères de fin de mission

La mission est complète quand :

1. Le rapport phase 1 est généré et partagé avec VIGNON.
2. Les migrations de phase 2 sont appliquées en production (Supabase prod).
3. Le dashboard de phase 4 est accessible et reflète la réalité.
4. Toutes les vérifications de phase 5 passent.
5. Un commit final récapitule les améliorations de complétude (avant/après en pourcentage) dans le message.

**Bon travail.** Tout est pédagogique : à chaque étape, prends 30 secondes pour expliquer dans le commit *pourquoi* tu fais la chose et pas seulement *ce que* tu fais.


