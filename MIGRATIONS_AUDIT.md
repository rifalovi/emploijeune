# Audit des migrations — 31 mai 2026

## Constat

Sur 71 migrations SQL dans `supabase/migrations/`, seules **35 etaient enregistrees** dans `supabase_migrations.schema_migrations` (la table de tracking interne de Supabase).

**Cause** : toutes les migrations depuis le 28 avril 2026 (`20260428200001`) ont ete appliquees manuellement via le SQL Editor Supabase ou l'API Management (`/v1/projects/{id}/database/query`), sans passer par `supabase db push` ou `supabase migration up`. Le SQL a bien tourne (les tables, RPC, index existent en prod) mais Supabase ne savait pas que ces migrations avaient ete appliquees.

**Risque** : si quelqu'un lance `supabase db push`, Supabase tentera de re-executer les 35 migrations "manquantes", ce qui provoquera des erreurs `already exists` ou pire, des doublons de donnees.

## Correction effectuee

Le 31/05/2026, les 35 entrees manquantes ont ete inserees dans `schema_migrations` via :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260428200001', 'kpis_dashboard_super_admin'),
  ('20260428200002', 'module_ia_enrichi'),
  -- ... (35 lignes au total)
  ('20260531000010', 'maintenance_purge_recalcul')
ON CONFLICT (version) DO NOTHING;
```

**Resultat** : 71 migrations trackees, de `20260422000001` a `20260531000010`.

## Anomalie : version dupliquee `20260520120001`

Deux fichiers partagent la meme version :
- `20260520120001_liens_collecte_publique_type_c.sql`
- `20260520120001_strate_questionnaire_c.sql`

La PK de `schema_migrations` est sur `version` (TEXT). Un seul enregistrement peut exister. L'entree inseree combine les deux noms : `liens_collecte_publique_type_c + strate_questionnaire_c`.

**Recommandation** : renommer un des deux fichiers avec un timestamp different (ex. `20260520120002_strate_questionnaire_c.sql`) pour eviter toute confusion future. Pas bloquant car les deux ont ete appliquees.

## Migrations par periode

| Periode | Fichiers | Trackees avant audit | Methode d'application |
|---|---|---|---|
| 22-28 avr 2026 | 35 | 35 | `supabase db push` (normal) |
| 28 avr - 14 mai 2026 | 22 | 0 → 22 (corrige) | SQL Editor manuel |
| 20-31 mai 2026 | 14 | 0 → 14 (corrige) | API Management + SQL Editor |

## Recommandation pour la suite

1. **Privilegier `supabase db push`** pour appliquer les nouvelles migrations. Cela les enregistre automatiquement.
2. Si une migration doit etre appliquee manuellement (urgence), **toujours inserer l'entree** dans `schema_migrations` immediatement apres :
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('VERSION', 'nom_migration');
   ```
3. **Toutes les migrations doivent etre idempotentes** : utiliser `CREATE OR REPLACE`, `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` pour eviter les erreurs en cas de re-execution.
