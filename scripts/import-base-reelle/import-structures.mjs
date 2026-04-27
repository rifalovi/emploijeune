/**
 * Script d'import des structures (B1) depuis la base de sondage OIF
 * (data/oif/import/structures-reelles.csv → public.structures).
 *
 * Idempotent : index unique (import_source, import_index).
 *
 * Usage :
 *   node scripts/import-base-reelle/import-structures.mjs
 *
 * Variables d'environnement requises :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Limitations connues :
 *   - Le CSV ne fournit pas porteur_prenom/porteur_nom/porteur_sexe séparés.
 *     Compromis : si `responsable` est présent, on tente un split simple.
 *     Sinon, valeurs marqueurs « Non spécifié ».
 *   - Pas de date_creation : on laisse NULL.
 *   - type_structure et nature_appui ne sont pas dans le CSV : on utilise
 *     les codes les plus représentatifs ('AUTRE') en attendant complément
 *     terrain (V1.5 ou correction manuelle post-import).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

import {
  PROJET_LEGACY_VERS_OFFICIEL,
  paysCode,
  texteOuNull,
  nombreOuNull,
} from './lib-mapping.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..', '..');

dotenvConfig({ path: path.join(RACINE, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local');
  process.exit(1);
}

const IMPORT_SOURCE = 'BASE_OIF_230426_V2';
const IMPORT_BATCH = `${new Date().toISOString().slice(0, 10)}-migration-initiale`;
const TAILLE_LOT = 200;

// Codes par défaut pour les colonnes obligatoires manquantes dans le CSV.
// Les bénéficiaires terrain pourront les enrichir via l'UI d'édition.
const TYPE_STRUCTURE_DEFAUT = 'AUTRE';
const SECTEUR_DEFAUT = 'AUTRE';
const NATURE_APPUI_DEFAUT = 'AUTRE';
const STATUT_CREATION_DEFAUT = 'creation';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lecture + parsing du CSV
// ─────────────────────────────────────────────────────────────────────────────

const cheminCsv = path.join(RACINE, 'data/oif/import/structures-reelles.csv');
console.log(`📄 Lecture ${path.relative(RACINE, cheminCsv)}…`);

const contenu = readFileSync(cheminCsv, 'utf8');
const lignes = parse(contenu, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
  relax_quotes: true,
});

console.log(`✓ ${lignes.length} lignes parsées`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mapping CSV → schéma BDD
// ─────────────────────────────────────────────────────────────────────────────

/** Split heuristique d'un nom complet en (prénom, nom). */
function splitNomComplet(brut) {
  const t = (brut ?? '').trim();
  if (!t) return { prenom: 'Non', nom: 'spécifié' };
  const tokens = t.split(/\s+/);
  if (tokens.length === 1) return { prenom: '—', nom: tokens[0] };
  return { prenom: tokens[0], nom: tokens.slice(1).join(' ') };
}

const erreurs = [];
const aInserer = [];

for (const ligne of lignes) {
  const index = Number(ligne.n);
  if (!Number.isFinite(index)) {
    erreurs.push({ erreur: 'Index n manquant', ligne: 0, raw: ligne });
    continue;
  }

  const projetCode = PROJET_LEGACY_VERS_OFFICIEL[(ligne.projet ?? '').trim()];
  if (!projetCode) {
    erreurs.push({
      erreur: `Code projet inconnu : "${ligne.projet}"`,
      ligne: index,
      raw: ligne,
    });
    continue;
  }

  const codePays = paysCode(ligne.pays);
  if (!codePays) {
    erreurs.push({
      erreur: `Pays non mappé : "${ligne.pays}"`,
      ligne: index,
      raw: ligne,
    });
    continue;
  }

  const nomStructure = texteOuNull(ligne.nom);
  if (!nomStructure) {
    erreurs.push({ erreur: 'Nom structure manquant', ligne: index, raw: ligne });
    continue;
  }

  const annee = Number(ligne.annee) || 2024;
  const { prenom: porteurPrenom, nom: porteurNom } = splitNomComplet(ligne.responsable);

  aInserer.push({
    nom_structure: nomStructure,
    type_structure_code: TYPE_STRUCTURE_DEFAUT,
    secteur_activite_code: SECTEUR_DEFAUT,
    secteur_precis: texteOuNull(ligne.secteur),
    intitule_initiative: texteOuNull(ligne.initiative),
    statut_creation: STATUT_CREATION_DEFAUT,
    projet_code: projetCode,
    pays_code: codePays,
    porteur_prenom: porteurPrenom,
    porteur_nom: porteurNom,
    porteur_sexe: 'Autre', // non collecté dans le CSV — à enrichir terrain
    annee_appui: annee,
    nature_appui_code: NATURE_APPUI_DEFAUT,
    montant_appui: nombreOuNull(ligne.montant_appui) ?? null,
    telephone_porteur: texteOuNull(ligne.telephone),
    courriel_porteur: texteOuNull(ligne.email),
    consentement_recueilli: true,
    consentement_date: `${annee}-01-01`,
    consentement_origine: 'COLLECTE_INITIALE_OIF',
    source_import: 'excel_v1',
    import_source: IMPORT_SOURCE,
    import_batch: IMPORT_BATCH,
    import_index: index,
  });
}

console.log(`✓ ${aInserer.length} lignes valides — ${erreurs.length} rejetées avant insert`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Insertion par lots avec idempotence
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let nbInserees = 0;
let nbConflits = 0;
const erreursInsert = [];

for (let i = 0; i < aInserer.length; i += TAILLE_LOT) {
  const lot = aInserer.slice(i, i + TAILLE_LOT);
  const debut = lot[0]?.import_index ?? i;
  const fin = lot[lot.length - 1]?.import_index ?? i + lot.length - 1;

  const { data, error } = await supabase
    .from('structures')
    .upsert(lot, {
      onConflict: 'import_source,import_index',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    console.error(`✗ Lot lignes ${debut}-${fin} : ${error.message}`);
    erreursInsert.push({ debut, fin, message: error.message });
    continue;
  }

  const inserees = data?.length ?? 0;
  nbInserees += inserees;
  nbConflits += lot.length - inserees;
  console.log(
    `✓ Lot ${debut}-${fin} : ${inserees} insérées, ${lot.length - inserees} déjà présentes`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rapport final
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('RAPPORT D\u2019IMPORT — STRUCTURES');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Source            : ${IMPORT_SOURCE}`);
console.log(`Batch             : ${IMPORT_BATCH}`);
console.log(`Lignes parsées    : ${lignes.length}`);
console.log(`Lignes valides    : ${aInserer.length}`);
console.log(`Lignes insérées   : ${nbInserees}`);
console.log(`Lignes déjà présentes (idempotence) : ${nbConflits}`);
console.log(`Lignes rejetées (mapping) : ${erreurs.length}`);
console.log(`Lots en erreur SQL : ${erreursInsert.length}`);

if (erreurs.length > 0) {
  console.log('\nDétail des rejets (50 premiers) :');
  for (const e of erreurs.slice(0, 50)) {
    console.log(`  • ligne ${e.ligne} — ${e.erreur}`);
  }
  if (erreurs.length > 50) {
    console.log(`  … et ${erreurs.length - 50} autres`);
  }
}

if (erreursInsert.length > 0) {
  console.log('\nDétail des erreurs SQL :');
  for (const e of erreursInsert) {
    console.log(`  • lot ${e.debut}-${e.fin} : ${e.message}`);
  }
}

process.exit(erreursInsert.length > 0 ? 1 : 0);
