#!/usr/bin/env node
/**
 * Bootstrap du premier admin SCS — Hotfix 6.5h (26/04/2026).
 *
 * Pourquoi ce script ?
 *   En V1, la création de comptes est restreinte à `admin_scs` via la page
 *   `/admin/utilisateurs`. Mais lors de l'installation initiale, AUCUN
 *   compte n'existe → personne ne peut se connecter pour créer le premier
 *   admin. Ce script résout ce problème de l'œuf et de la poule en
 *   utilisant la clé `service_role` Supabase pour bootstrapper le premier
 *   compte admin SCS.
 *
 * Usage :
 *   node --env-file=.env.local scripts/bootstrap-admin-scs.mjs <email> <prenom> <nom>
 *
 * Exemple :
 *   node --env-file=.env.local scripts/bootstrap-admin-scs.mjs carlos.hounsinou@francophonie.org Carlos HOUNSINOU
 *
 * Pré-requis env (lus depuis `.env.local` via le flag Node 20+) :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Comportement :
 *   1. Vérifie qu'AUCUN admin_scs n'existe déjà (refuse sinon —
 *      pour exécuter à nouveau, supprimer la ligne d'abord).
 *   2. Crée l'utilisateur Auth avec un mot de passe temporaire aléatoire.
 *   3. Insère la ligne dans `public.utilisateurs` avec
 *      role='admin_scs', statut_validation='valide', actif=true.
 *   4. Génère un lien de récupération (type 'recovery') et l'affiche
 *      dans la console — l'utilisateur clique dessus pour définir
 *      son vrai mot de passe.
 *
 * Sécurité :
 *   - À exécuter UNE SEULE FOIS au démarrage du projet.
 *   - Ne jamais commiter la clé service_role (elle reste dans `.env.local`).
 *   - L'opération est idempotente : refuse si un admin_scs existe déjà.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

// Les variables d'environnement sont chargées via le flag
// `node --env-file=.env.local` (Node 20+ natif, pas de dépendance dotenv).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    '❌ Variables manquantes. Vérifiez que .env.local contient :\n' +
      '   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co\n' +
      '   SUPABASE_SERVICE_ROLE_KEY=eyJ... (depuis Supabase Dashboard → Settings → API)\n',
  );
  process.exit(1);
}

const [, , email, prenom, ...nomParts] = process.argv;
const nom = nomParts.join(' ');

if (!email || !prenom || !nom) {
  console.error('❌ Usage : node scripts/bootstrap-admin-scs.mjs <email> <prenom> <nom>');
  console.error(
    '   Exemple : node scripts/bootstrap-admin-scs.mjs carlos@francophonie.org Carlos HOUNSINOU',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.info(`\n🚀 Bootstrap admin SCS pour ${email}\n`);

  // 1. Vérifie qu'aucun admin_scs n'existe déjà
  const { data: existing, error: checkError } = await supabase
    .from('utilisateurs')
    .select('id, nom_complet')
    .eq('role', 'admin_scs')
    .is('deleted_at', null)
    .limit(1);

  if (checkError) {
    console.error('❌ Erreur lecture utilisateurs :', checkError.message);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.error(
      `❌ Un admin SCS existe déjà : "${existing[0].nom_complet}". ` +
        "Pour ré-exécuter ce script, supprimez d'abord cette ligne via la console Supabase.",
    );
    process.exit(1);
  }

  // 2. Création Auth user
  const mdpTemporaire = randomBytes(16).toString('hex');
  console.info("📧 Création de l'utilisateur Auth...");

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: mdpTemporaire,
    email_confirm: true,
    user_metadata: {
      mdp_temporaire: true,
      bootstrap: true,
      cree_le: new Date().toISOString(),
    },
  });

  if (authError || !authData?.user) {
    console.error('❌ Création Auth échouée :', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.info(`✓ Auth user créé : ${userId}`);

  // 3. INSERT public.utilisateurs (role admin_scs, validé)
  console.info('💾 Insertion dans public.utilisateurs...');
  const nomComplet = `${prenom} ${nom.toLocaleUpperCase('fr-FR')}`.trim();

  const { error: insertError } = await supabase.from('utilisateurs').insert({
    user_id: userId,
    nom_complet: nomComplet,
    role: 'admin_scs',
    actif: true,
    statut_validation: 'valide',
  });

  if (insertError) {
    // Rollback Auth user pour éviter compte orphelin
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    console.error('❌ Insertion utilisateurs échouée :', insertError.message);
    console.error("   → Compte Auth supprimé pour éviter l'orphelin.");
    process.exit(1);
  }

  console.info(`✓ Profil utilisateur inséré (${nomComplet})`);

  // 4. Génère le lien de récupération
  console.info("🔗 Génération du lien d'activation...");
  const redirectTo = `${APP_URL}/api/auth/callback?redirect=${encodeURIComponent('/motpasse/changer?premier_login=1')}`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('⚠️ Génération lien échouée :', linkError?.message);
    console.error(
      '   Le compte est créé mais sans lien d\'activation. Utilisez "Mot de passe oublié" sur /connexion.',
    );
    process.exit(0);
  }

  console.info('\n✅ Bootstrap réussi !\n');
  console.info('━'.repeat(70));
  console.info("Lien d'activation (valable 1 h, à coller dans le navigateur) :\n");
  console.info(linkData.properties.action_link);
  console.info('━'.repeat(70));
  console.info('\nÉtapes suivantes :');
  console.info(`  1. Ouvrez le lien ci-dessus dans votre navigateur.`);
  console.info(`  2. Définissez votre mot de passe (≥8 chars, 1 maj, 1 chiffre).`);
  console.info(`  3. Connectez-vous sur ${APP_URL}/connexion avec ${email}.`);
  console.info(`  4. Vous pourrez ensuite créer d'autres comptes via /admin/utilisateurs.\n`);
}

main().catch((err) => {
  console.error('❌ Erreur inattendue :', err);
  process.exit(1);
});
