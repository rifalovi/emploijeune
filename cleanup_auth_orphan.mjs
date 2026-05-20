/**
 * cleanup_auth_orphan.mjs
 * Libère l'email d'un utilisateur orphelin en renommant son email dans auth.users.
 * (Contournement quand auth.admin.deleteUser() échoue sur FK internes Supabase)
 *
 * Usage : node cleanup_auth_orphan.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gflragycnsaeqppgnfna.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbHJhZ3ljbnNhZXFwcGduZm5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNzY4NiwiZXhwIjoyMDkyMzgzNjg2fQ.etMecza5G3_PKD7_eFBwH5ALaxHSN-gBn1gYOTGeWok';
const EMAIL = 'carlos.hounsinou@francophonie.org';

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n🔍 Recherche de l'utilisateur auth : ${EMAIL}\n`);

const { data, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listErr) { console.error('❌ listUsers:', listErr.message); process.exit(1); }

const user = data.users.find(u => u.email === EMAIL);
if (!user) {
  console.log('✅ Email déjà libre — utilisateur introuvable dans auth.users.');
  process.exit(0);
}

console.log(`👤 Trouvé : id=${user.id}  email=${user.email}`);

// ── Tentative 1 : suppression directe ────────────────────────────────────────
console.log('\n🗑️  Tentative de suppression directe...');
const { error: delErr } = await db.auth.admin.deleteUser(user.id);

if (!delErr) {
  console.log(`✅ SUCCÈS : utilisateur supprimé. ${EMAIL} est libre.\n`);
  process.exit(0);
}

console.log(`  ↳ Échec deleteUser: ${delErr.message}`);
console.log('  → Passage au plan B : renommage de l\'email\n');

// ── Tentative 2 : renommer l'email pour libérer l'adresse ────────────────────
const emailPoubelle = `deleted_${user.id.substring(0, 8)}@deleted.invalid`;
console.log(`📝 Remplacement de l'email :`);
console.log(`   ${EMAIL}  →  ${emailPoubelle}`);

const { data: updated, error: updateErr } = await db.auth.admin.updateUserById(user.id, {
  email: emailPoubelle,
  email_confirm: true,
  ban_duration: 'none',
});

if (updateErr) {
  console.error(`\n❌ Renommage échoué : ${updateErr.message}`);
  console.error('\nOption manuelle : allez sur https://supabase.com/dashboard/project/gflragycnsaeqppgnfna/auth/users');
  console.error(`et modifiez manuellement l'email de l'utilisateur ${user.id} (${EMAIL})`);
  process.exit(1);
}

console.log(`\n✅ Email renommé → ${updated.user.email}`);

// ── Vérification : l'ancien email est-il libre ? ──────────────────────────────
const { data: check } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const encore = check?.users.find(u => u.email === EMAIL);
if (encore) {
  console.error(`\n⚠️  ATTENTION : ${EMAIL} est encore présent dans auth.users (id: ${encore.id})`);
  process.exit(1);
}

console.log(`\n🎉 SUCCÈS : ${EMAIL} est maintenant libre pour recréation.\n`);
console.log(`ℹ️  L'ancien compte orphelin (id: ${user.id}) existe toujours dans auth.users`);
console.log(`   avec l'email "${emailPoubelle}" — il peut être supprimé manuellement plus tard.`);
