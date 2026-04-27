/**
 * Script de vérification post-import : compte les lignes insérées avec
 * marqueur `import_source = 'BASE_OIF_230426_V2'` et compare aux totaux
 * attendus (5 618 bénéficiaires + 341 structures).
 *
 * Usage : node scripts/import-base-reelle/verify-import.mjs
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..', '..');
dotenvConfig({ path: path.join(RACINE, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

const IMPORT_SOURCE = 'BASE_OIF_230426_V2';
const ATTENDU = { beneficiaires: 5618, structures: 341 };

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function compter(table, colonne) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(colonne, IMPORT_SOURCE)
    .is('deleted_at', null);
  if (error) throw new Error(`${table} : ${error.message}`);
  return count ?? 0;
}

async function distinct(table, colonne) {
  const { data, error } = await supabase
    .from(table)
    .select(colonne)
    .eq('import_source', IMPORT_SOURCE)
    .is('deleted_at', null);
  if (error) throw new Error(`${table}.${colonne} : ${error.message}`);
  return new Set((data ?? []).map((r) => r[colonne])).size;
}

console.log('🔍 Vérification post-import\n');

const benef = await compter('beneficiaires', 'import_source');
const struct = await compter('structures', 'import_source');
const benefPays = await distinct('beneficiaires', 'pays_code');
const benefProjets = await distinct('beneficiaires', 'projet_code');
const structPays = await distinct('structures', 'pays_code');
const structProjets = await distinct('structures', 'projet_code');

const log = (label, val, attendu = null) => {
  const ok = attendu === null || val === attendu;
  const icone = ok ? '✓' : '✗';
  const cible = attendu !== null ? ` (attendu : ${attendu})` : '';
  console.log(`${icone} ${label.padEnd(40)} ${val}${cible}`);
};

log('Bénéficiaires importés', benef, ATTENDU.beneficiaires);
log('  → pays distincts', benefPays);
log('  → projets distincts', benefProjets);
log('Structures importées', struct, ATTENDU.structures);
log('  → pays distincts', structPays);
log('  → projets distincts', structProjets);

const ok =
  benef === ATTENDU.beneficiaires && struct === ATTENDU.structures;
console.log(
  `\n${ok ? '✅' : '⚠️ '}  Total : ${benef + struct} lignes importées (${benef} A1 + ${struct} B1)`,
);

process.exit(ok ? 0 : 1);
