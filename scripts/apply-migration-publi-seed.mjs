import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error('SUPABASE_PROJECT_ID ou SUPABASE_ACCESS_TOKEN manquant dans .env.local');
  process.exit(1);
}

const migrationPath = 'supabase/migrations/20260512400001_publication_saisies_et_seed_demo.sql';
const sql = readFileSync(migrationPath, 'utf8');
console.log(`Reading ${migrationPath} (${sql.length} bytes)`);
console.log(`Project: ${projectRef}`);

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
console.log(`HTTP ${res.status}`);
console.log('Body:', JSON.stringify(body, null, 2));

if (res.status === 200 || res.status === 201) {
  console.log('Migration appliquee avec succes');
} else {
  console.error('Echec de la migration');
  process.exit(1);
}
