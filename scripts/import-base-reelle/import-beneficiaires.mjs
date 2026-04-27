/**
 * Script d'import des bénéficiaires (A1) depuis la base de sondage OIF
 * (data/oif/import/beneficiaires-reels.csv → public.beneficiaires).
 *
 * Idempotent : utilise l'index unique (import_source, import_index). Une
 * réexécution ne crée aucun doublon.
 *
 * Usage :
 *   node scripts/import-base-reelle/import-beneficiaires.mjs
 *
 * Variables d'environnement requises (dans .env.local ou process.env) :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Comportement :
 *   - Lit le CSV (RFC 4180, support guillemets/virgules embarquées).
 *   - Mappe les codes projets P14 → PROJ_A14 (cf. projets_codes_legacy).
 *   - Mappe les libellés pays → codes ISO 3 lettres.
 *   - Sexe F/H → enum BDD F/M (les valeurs "Autre" non utilisées dans la base OIF).
 *   - Génère un email technique pour les lignes sans courriel (anti-doublon).
 *   - Marque consentement_recueilli = TRUE + consentement_origine = COLLECTE_INITIALE_OIF.
 *   - Insertion par lots de 500 avec ON CONFLICT (import_source, import_index) DO NOTHING.
 *
 * Stratégie tolérante : une ligne en erreur n'interrompt pas le batch, elle
 * est rapportée à la fin avec son index source.
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
  sexeCode,
  dateDebutFormation,
  emailTechnique,
  texteOuNull,
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
const TAILLE_LOT = 500;

// Domaine de formation par défaut quand l'intitulé libre ne permet pas de
// déterminer un code. La BDD impose un code parmi public.domaines_formation.
// "AUTRE" est un code générique disponible dans le seed.
const DOMAINE_DEFAUT = 'AUTRE';
const STATUT_DEFAUT = 'FORMATION_ACHEVEE'; // Toutes ces personnes ont été formées

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lecture + parsing du CSV
// ─────────────────────────────────────────────────────────────────────────────

const cheminCsv = path.join(RACINE, 'data/oif/import/beneficiaires-reels.csv');
console.log(`📄 Lecture ${path.relative(RACINE, cheminCsv)}…`);

const contenu = readFileSync(cheminCsv, 'utf8');
const lignes = parse(contenu, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
});

console.log(`✓ ${lignes.length} lignes parsées`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mapping CSV → schéma BDD
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Array<{ erreur: string, ligne: number, raw: object }>} */
const erreurs = [];
/** @type {Array<object>} */
const aInserer = [];

for (const ligne of lignes) {
  const index = Number(ligne.n);
  if (!Number.isFinite(index)) {
    erreurs.push({ erreur: 'Index n manquant ou invalide', ligne: 0, raw: ligne });
    continue;
  }

  const projetLegacy = (ligne.projet ?? '').trim();
  const projetCode = PROJET_LEGACY_VERS_OFFICIEL[projetLegacy];
  if (!projetCode) {
    erreurs.push({
      erreur: `Code projet inconnu : "${projetLegacy}"`,
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

  const sexe = sexeCode(ligne.sexe);
  if (!sexe) {
    erreurs.push({ erreur: `Sexe inconnu : "${ligne.sexe}"`, ligne: index, raw: ligne });
    continue;
  }

  const prenom = texteOuNull(ligne.prenom) ?? 'Prénom inconnu';
  const nom = texteOuNull(ligne.nom) ?? 'Nom inconnu';
  const annee = Number(ligne.annee) || 2024;
  const dateDebut = dateDebutFormation(annee);
  const courrielReel = texteOuNull(ligne.courriel);
  const courriel =
    courrielReel && courrielReel.includes('@')
      ? courrielReel.toLowerCase()
      : emailTechnique(prenom, nom, index);

  aInserer.push({
    prenom,
    nom,
    sexe,
    projet_code: projetCode,
    pays_code: codePays,
    domaine_formation_code: DOMAINE_DEFAUT,
    intitule_formation: texteOuNull(ligne.type_formation),
    annee_formation: annee,
    date_debut_formation: dateDebut,
    statut_code: STATUT_DEFAUT,
    fonction_actuelle: texteOuNull(ligne.fonction),
    partenaire_accompagnement: texteOuNull(ligne.organisation_accompagnement),
    courriel,
    consentement_recueilli: true,
    consentement_date: dateDebut,
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

  // upsert avec onConflict sur l'index unique d'idempotence
  const { data, error } = await supabase
    .from('beneficiaires')
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
console.log('RAPPORT D\u2019IMPORT — BÉNÉFICIAIRES');
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
