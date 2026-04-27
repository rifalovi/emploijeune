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
  paysCodeAvecTrace,
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
/** @type {Array<{ ligne: number, libelleSource: string, raison: string }>} */
const paysFallbacks = [];

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

  const {
    code: codePays,
    fallback: paysFallback,
    raison: paysRaison,
  } = paysCodeAvecTrace(ligne.pays);
  if (paysFallback) {
    // Hotfix v1.2.6 : fallback ZZZ au lieu de rejet (décision Carlos Option B).
    // On trace l'incident pour le rapport mais la ligne reste importée.
    paysFallbacks.push({ ligne: index, libelleSource: ligne.pays ?? '', raison: paysRaison });
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
// 3. Insertion ligne par ligne via RPC upsert_beneficiaire_import
//    (le SDK Supabase JS ne sait pas piloter ON CONFLICT WHERE sur un index
//     partiel — cf. migration 019 hotfix v1.2.6)
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let nbInserees = 0;
let nbConflits = 0;
const erreursInsert = [];
const debutTs = Date.now();

for (let i = 0; i < aInserer.length; i++) {
  const ligne = aInserer[i];
  const { data, error } = await supabase.rpc('upsert_beneficiaire_import', {
    p_payload: ligne,
  });

  if (error) {
    erreursInsert.push({ index: ligne.import_index, message: error.message });
    if (erreursInsert.length <= 5) {
      console.error(`✗ Ligne ${ligne.import_index} : ${error.message}`);
    }
    continue;
  }

  const payload = data;
  if (payload?.inserted) nbInserees++;
  else if (payload?.conflicted) nbConflits++;

  // Progrès tous les 200 inserts
  if ((i + 1) % 200 === 0 || i === aInserer.length - 1) {
    const pct = Math.round((100 * (i + 1)) / aInserer.length);
    const elapsed = Math.round((Date.now() - debutTs) / 1000);
    console.log(
      `… ${i + 1}/${aInserer.length} (${pct}%) — ${nbInserees} insérées · ${nbConflits} déjà présentes · ${erreursInsert.length} erreurs · ${elapsed}s`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rapport final
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('RAPPORT D\u2019IMPORT — BÉNÉFICIAIRES');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Source            : ${IMPORT_SOURCE}`);
console.log(`Batch             : ${IMPORT_BATCH}`);
console.log(`Lignes parsées             : ${lignes.length}`);
console.log(`Lignes valides             : ${aInserer.length}`);
console.log(`Lignes insérées            : ${nbInserees}`);
console.log(`Lignes déjà présentes (idempotence) : ${nbConflits}`);
console.log(`Lignes rejetées (mapping)  : ${erreurs.length}`);
console.log(`Pays fallback ZZZ          : ${paysFallbacks.length}`);
console.log(`Lignes en erreur SQL       : ${erreursInsert.length}`);

if (erreurs.length > 0) {
  console.log('\nDétail des rejets (50 premiers) :');
  for (const e of erreurs.slice(0, 50)) {
    console.log(`  • ligne ${e.ligne} — ${e.erreur}`);
  }
  if (erreurs.length > 50) {
    console.log(`  … et ${erreurs.length - 50} autres`);
  }
}

if (paysFallbacks.length > 0) {
  console.log('\nFallbacks pays ZZZ (libellés inattendus) — 30 premiers :');
  const recap = new Map();
  for (const f of paysFallbacks) {
    const k = f.libelleSource || '(vide)';
    recap.set(k, (recap.get(k) ?? 0) + 1);
  }
  const top = Array.from(recap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  for (const [lib, n] of top) {
    console.log(`  • ${lib}: ${n}`);
  }
}

if (erreursInsert.length > 0) {
  console.log('\nDétail des erreurs SQL (10 premières) :');
  for (const e of erreursInsert.slice(0, 10)) {
    console.log(`  • ligne ${e.index} : ${e.message}`);
  }
  if (erreursInsert.length > 10) {
    console.log(`  … et ${erreursInsert.length - 10} autres`);
  }
}

process.exit(erreursInsert.length > 0 ? 1 : 0);
