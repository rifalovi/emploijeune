#!/usr/bin/env node
/**
 * Applique les migrations 027 et 028 via l'API Management Supabase.
 *
 * Usage: node scripts/apply-migrations-027-028.mjs
 *
 * Variables d'environnement requises (dans .env.local) :
 *   - SUPABASE_ACCESS_TOKEN : Personal Access Token Supabase
 *     (https://supabase.com/dashboard/account/tokens)
 *   - NEXT_PUBLIC_SUPABASE_URL : optionnelle, sinon PROJECT_REF est utilisé
 *
 * IMPORTANT : ne jamais hardcoder un token Supabase dans ce fichier.
 * GitHub Secret Scanning détectera et bloquera le push (sbp_* est un
 * pattern reconnu).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dir, '..', '.env.local') });

const PROJECT_REF = 'gflragycnsaeqppgnfna';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error(
    '❌ SUPABASE_ACCESS_TOKEN manquant dans .env.local.\n' +
      '   Générer un token sur https://supabase.com/dashboard/account/tokens',
  );
  process.exit(1);
}

async function applyMigration(label, file) {
  const sql = readFileSync(join(__dir, '..', 'supabase/migrations', file), 'utf8');
  console.log(`\n⏳ Application de ${label}…`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✅ ${label} appliquée avec succès`);
  } else {
    console.error(`❌ Erreur sur ${label}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

await applyMigration(
  'Migration 027 (lister_sessions_enquete + tranche_age_declaree)',
  '20260511000003_sessions_enquete_tranche_age.sql',
);

await applyMigration(
  'Migration 028 (analyses_indicateurs)',
  '20260511100001_analyses_indicateurs.sql',
);

await applyMigration(
  'Migration 028-fix (RLS u.id → u.user_id sur analyses_indicateurs)',
  '20260511200001_fix_rls_analyses_indicateurs.sql',
);

console.log('\n🎉 Toutes les migrations ont été appliquées avec succès.');
