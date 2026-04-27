/**
 * Script seed-utilisateurs-demo (Sprint 5 — V1.3.0)
 *
 * Crée 4 comptes utilisateurs de démonstration pour les tests parcours
 * et la démo institutionnelle (pilote juin 2026 — 60 partenaires).
 *
 * Idempotent : si un compte existe déjà (par email), il n'est ni
 * recréé ni modifié. Les affectations projets sont aussi idempotentes
 * via les Server Actions affectation-projet (UNIQUE user_id+projet_code).
 *
 * Usage :
 *   node scripts/seed-utilisateurs-demo.mjs
 *
 * Variables d'environnement requises (.env.local) :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Comptes créés :
 *   1. Marie KOUASSI — chef_projet
 *      - Affectations : PROJ_A14 (il y a 18 mois), PROJ_A19 (12 mois)
 *   2. Jean DUPONT — chef_projet
 *      - Affectations : PROJ_A06 (9 mois), PROJ_A18 (4 mois)
 *   3. Aminata DIALLO — chef_projet (co-coordinatrice)
 *      - Affectations : PROJ_A14 co_gestionnaire (3 mois)
 *   4. Direction CLAC Béoumi — contributeur_partenaire
 *      - Rattachée à une organisation contenant la structure CLAC Béoumi
 *
 * Mot de passe initial pour tous : DemoOIF2026 (à changer en prod)
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');
dotenvConfig({ path: path.join(RACINE, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  process.exit(1);
}

const MOT_PASSE = 'DemoOIF2026';

const COMPTES = [
  {
    email: 'marie.kouassi@francophonie.org',
    nom_complet: 'Marie KOUASSI',
    role: 'editeur_projet',
    organisation_nom: 'Service de Conception et Suivi (SCS)',
    affectations: [
      { projet_code: 'PROJ_A14', role_dans_projet: 'gestionnaire_principal', mois_anciennete: 18, raison: 'Coordination Afrique de l\u2019Ouest — Francophonie avec Elles' },
      { projet_code: 'PROJ_A19', role_dans_projet: 'gestionnaire_principal', mois_anciennete: 12, raison: 'Extension portfolio environnement Bassin du Congo' },
    ],
  },
  {
    email: 'jean.dupont@francophonie.org',
    nom_complet: 'Jean DUPONT',
    role: 'editeur_projet',
    organisation_nom: 'Service de Conception et Suivi (SCS)',
    affectations: [
      { projet_code: 'PROJ_A06', role_dans_projet: 'gestionnaire_principal', mois_anciennete: 9, raison: 'Industries culturelles — pilotage Afrique francophone' },
      { projet_code: 'PROJ_A18', role_dans_projet: 'gestionnaire_principal', mois_anciennete: 4, raison: 'Lancement portefeuille climat & environnement' },
    ],
  },
  {
    email: 'aminata.diallo@francophonie.org',
    nom_complet: 'Aminata DIALLO',
    role: 'editeur_projet',
    organisation_nom: 'Service de Conception et Suivi (SCS)',
    affectations: [
      { projet_code: 'PROJ_A14', role_dans_projet: 'co_gestionnaire', mois_anciennete: 3, raison: 'Renfort Francophonie avec Elles — co-coordination' },
    ],
  },
  {
    email: 'direction@clac-beoumi.ci',
    nom_complet: 'Direction CLAC Béoumi',
    role: 'contributeur_partenaire',
    organisation_nom: 'CLAC Béoumi (Côte d\u2019Ivoire)',
    affectations: [],
  },
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function trouverOuCreerOrganisation(nom) {
  const { data: existante } = await supabase
    .from('organisations')
    .select('id, nom')
    .eq('nom', nom)
    .is('deleted_at', null)
    .maybeSingle();

  if (existante) return existante.id;

  const { data: creee, error } = await supabase
    .from('organisations')
    .insert({
      nom,
      type: 'partenaire',
      pays_code: 'FRA', // Siège OIF Paris par défaut, peut être ajusté terrain
      actif: true,
    })
    .select('id')
    .single();

  if (error || !creee) {
    throw new Error(`Création organisation "${nom}" échouée : ${error?.message ?? '?'}`);
  }
  console.log(`  ✓ Organisation créée : ${nom}`);
  return creee.id;
}

async function trouverAuthUserParEmail(email) {
  // listUsers paginé — pour 5 comptes c'est suffisant.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers échoué : ${error.message}`);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function creerOuTrouverAuthUser(email, nomComplet) {
  const existant = await trouverAuthUserParEmail(email);
  if (existant) return { user: existant, deja: true };

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: MOT_PASSE,
    email_confirm: true,
    user_metadata: { nom_complet: nomComplet },
  });
  if (error || !data.user) {
    throw new Error(`createUser ${email} échoué : ${error?.message ?? '?'}`);
  }
  return { user: data.user, deja: false };
}

async function creerOuMajProfilUtilisateur({ user_id, nom_complet, role, organisation_id }) {
  const { data: existant } = await supabase
    .from('utilisateurs')
    .select('id, role, organisation_id, statut_validation, actif')
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existant) {
    // Idempotent : ajuste le profil si nécessaire mais ne casse rien.
    if (
      existant.role !== role ||
      existant.organisation_id !== organisation_id ||
      existant.statut_validation !== 'valide' ||
      !existant.actif
    ) {
      const { error } = await supabase
        .from('utilisateurs')
        .update({
          nom_complet,
          role,
          organisation_id,
          statut_validation: 'valide',
          actif: true,
        })
        .eq('id', existant.id);
      if (error) throw new Error(`UPDATE utilisateur ${user_id} : ${error.message}`);
      return { id: existant.id, action: 'updated' };
    }
    return { id: existant.id, action: 'unchanged' };
  }

  const { data: cree, error } = await supabase
    .from('utilisateurs')
    .insert({
      user_id,
      nom_complet,
      role,
      organisation_id,
      statut_validation: 'valide',
      actif: true,
    })
    .select('id')
    .single();
  if (error || !cree) throw new Error(`INSERT utilisateur : ${error?.message ?? '?'}`);
  return { id: cree.id, action: 'created' };
}

async function creerAffectation({ user_id, projet_code, role_dans_projet, mois_anciennete, raison, attribue_par }) {
  // Idempotence : UNIQUE (user_id, projet_code) sur affectation_projet_courante
  const { data: deja } = await supabase
    .from('affectation_projet_courante')
    .select('id')
    .eq('user_id', user_id)
    .eq('projet_code', projet_code)
    .maybeSingle();

  if (deja) return { action: 'skipped' };

  const dateDebut = new Date();
  dateDebut.setMonth(dateDebut.getMonth() - mois_anciennete);
  const dateDebutIso = dateDebut.toISOString();

  const { error: insErr } = await supabase
    .from('affectation_projet_courante')
    .insert({
      user_id,
      projet_code,
      role_dans_projet,
      date_debut: dateDebutIso,
      attribue_par,
      raison_debut: raison,
    });
  if (insErr) throw new Error(`INSERT affectation ${projet_code} : ${insErr.message}`);

  // Miroir historique (date_fin NULL = ligne active)
  await supabase.from('affectation_projet_historique').insert({
    user_id,
    projet_code,
    role_dans_projet,
    date_debut: dateDebutIso,
    attribue_par,
    raison_debut: raison,
  });

  return { action: 'created' };
}

async function trouverPremierAdminScs() {
  const { data } = await supabase
    .from('utilisateurs')
    .select('user_id')
    .eq('role', 'admin_scs')
    .eq('actif', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Execution
// ─────────────────────────────────────────────────────────────────────────────

console.log('🌱 Seed utilisateurs démo (Sprint 5 / v1.3.0)\n');

const adminScsUid = await trouverPremierAdminScs();
if (!adminScsUid) {
  console.warn(
    '⚠️  Aucun admin_scs trouvé en BDD — les affectations seront créées sans `attribue_par`.',
  );
}

const stats = { created: 0, updated: 0, unchanged: 0, affectations: 0 };

for (const compte of COMPTES) {
  console.log(`\n📩 ${compte.email}`);

  const orgId = await trouverOuCreerOrganisation(compte.organisation_nom);
  const { user, deja } = await creerOuTrouverAuthUser(compte.email, compte.nom_complet);

  if (deja) console.log(`  ↺ Auth user déjà présent (${user.id})`);
  else console.log(`  ✓ Auth user créé (${user.id}) — mdp : ${MOT_PASSE}`);

  const { action } = await creerOuMajProfilUtilisateur({
    user_id: user.id,
    nom_complet: compte.nom_complet,
    role: compte.role,
    organisation_id: orgId,
  });

  if (action === 'created') {
    stats.created++;
    console.log(`  ✓ Profil utilisateur créé (rôle ${compte.role})`);
  } else if (action === 'updated') {
    stats.updated++;
    console.log(`  ✓ Profil utilisateur mis à jour`);
  } else {
    stats.unchanged++;
    console.log(`  ↺ Profil utilisateur déjà conforme`);
  }

  for (const aff of compte.affectations) {
    const { action: aAction } = await creerAffectation({
      user_id: user.id,
      projet_code: aff.projet_code,
      role_dans_projet: aff.role_dans_projet,
      mois_anciennete: aff.mois_anciennete,
      raison: aff.raison,
      attribue_par: adminScsUid,
    });
    if (aAction === 'created') {
      stats.affectations++;
      console.log(
        `  ✓ Affectation ${aff.projet_code} (${aff.role_dans_projet}, il y a ${aff.mois_anciennete} mois)`,
      );
    } else {
      console.log(`  ↺ Affectation ${aff.projet_code} déjà présente`);
    }
  }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('RÉCAPITULATIF');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Comptes créés       : ${stats.created}`);
console.log(`Comptes mis à jour  : ${stats.updated}`);
console.log(`Comptes inchangés   : ${stats.unchanged}`);
console.log(`Affectations créées : ${stats.affectations}`);
console.log(`\nMot de passe initial : ${MOT_PASSE} (à changer en prod via UI)`);
