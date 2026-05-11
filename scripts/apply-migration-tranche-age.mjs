/**
 * Applique la migration tranche_age_declaree + relance l'import bénéficiaires.
 *
 * Usage depuis la racine du projet :
 *   node scripts/apply-migration-tranche-age.mjs
 *
 * Ce script :
 *   1. Applique la migration SQL (ajout colonne tranche_age_declaree)
 *   2. Re-importe les bénéficiaires depuis le CSV (idempotent — ON CONFLICT DO NOTHING)
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');

dotenvConfig({ path: path.join(RACINE, '.env.local') });

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT_TOKEN    = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── ÉTAPE 1 : vérifier si la migration est déjà appliquée ───────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('ÉTAPE 1 — Vérification migration tranche_age_declaree');
console.log('══════════════════════════════════════════════════════');

const { error: testErr } = await sb
  .from('beneficiaires')
  .select('tranche_age_declaree')
  .limit(1);

const colonneAbsente = testErr?.message?.includes('does not exist');

if (!colonneAbsente && !testErr) {
  console.log('✅ Colonne tranche_age_declaree déjà présente');
} else if (colonneAbsente) {
  console.log('Colonne absente → application via Management API...');

  if (!MGMT_TOKEN) {
    console.error('❌ SUPABASE_ACCESS_TOKEN absent dans .env.local');
    process.exit(1);
  }

  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

  const sqls = [
    `ALTER TABLE public.beneficiaires ADD COLUMN IF NOT EXISTS tranche_age_declaree TEXT CHECK (tranche_age_declaree IN ('Jeune', 'Adulte'))`,
    `CREATE INDEX IF NOT EXISTS idx_beneficiaires_tranche_age_declaree ON public.beneficiaires(tranche_age_declaree) WHERE deleted_at IS NULL AND tranche_age_declaree IS NOT NULL`,
    `COMMENT ON COLUMN public.beneficiaires.tranche_age_declaree IS 'Tranche age declaree base OIF : Jeune=18-34ans, Adulte=35ans+'`,
  ];

  for (const query of sqls) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Management API renvoie 200 OU 201 (Created) selon le type d'instruction
    // SQL — les deux sont des succès. N'échouer que sur >= 300.
    if (res.status >= 200 && res.status < 300) {
      console.log(`  ✅ [${res.status}] ${query.slice(0, 70)}...`);
    } else {
      const body = await res.text();
      console.error(`  ❌ [${res.status}] ${query.slice(0, 70)}`);
      console.error(`     ${body.slice(0, 300)}`);
      process.exit(1);
    }
  }
  console.log('✅ Migration appliquée avec succès !');
} else {
  console.error('❌ Erreur inattendue :', testErr?.message);
  process.exit(1);
}

// ─── ÉTAPE 2 : re-importer les bénéficiaires ─────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('ÉTAPE 2 — Re-import bénéficiaires (mise à jour tranche_age_declaree)');
console.log('══════════════════════════════════════════════════════');
console.log('Lancement de import-beneficiaires.mjs...\n');

const { execa } = await import('execa').catch(() => {
  // Fallback si execa non dispo
  return { execa: null };
});

if (execa) {
  try {
    const result = await execa('node', [
      path.join(RACINE, 'scripts/import-base-reelle/import-beneficiaires.mjs')
    ], { stdio: 'inherit', cwd: RACINE });
  } catch (e) {
    console.error('❌ Erreur lors de l\'import :', e.message);
    process.exit(1);
  }
} else {
  console.log('→ Lancez maintenant : node scripts/import-base-reelle/import-beneficiaires.mjs');
}

console.log('\n✅ Terminé ! La tranche d\'âge sera désormais correctement affichée.');
