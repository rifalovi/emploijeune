import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error('SUPABASE_PROJECT_ID ou SUPABASE_ACCESS_TOKEN manquant dans .env.local');
  process.exit(1);
}

const path = 'supabase/migrations/20260513100001_pays_oif_complets.sql';
const sql = readFileSync(path, 'utf8');
console.log(`Application ${path} (${sql.length} bytes) sur ${projectRef}`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  },
);
const body = await res.json().catch(() => res.text());
console.log(`HTTP ${res.status}`);
if (res.status === 200 || res.status === 201) {
  console.log('OK — migration appliquée');
} else {
  console.error('Échec:', JSON.stringify(body, null, 2));
  process.exit(1);
}
