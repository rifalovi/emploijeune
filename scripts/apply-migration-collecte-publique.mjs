import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error('SUPABASE_PROJECT_ID ou SUPABASE_ACCESS_TOKEN manquant dans .env.local');
  process.exit(1);
}

async function applyOne(path) {
  const sql = readFileSync(path, 'utf8');
  console.log(`\n→ ${path} (${sql.length} bytes)`);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.json().catch(() => res.text());
  console.log(`  HTTP ${res.status}`);
  if (!(res.status === 200 || res.status === 201)) {
    console.error('  Body:', JSON.stringify(body, null, 2));
    return false;
  }
  console.log('  OK');
  return true;
}

const migrations = [
  'supabase/migrations/20260512500001_purge_projets_non_officiels.sql',
  'supabase/migrations/20260512600001_liens_collecte_publique.sql',
];

for (const m of migrations) {
  const ok = await applyOne(m);
  if (!ok) {
    console.error(`Échec sur ${m} — arrêt.`);
    process.exit(1);
  }
}
console.log('\nMigrations appliquées.');
