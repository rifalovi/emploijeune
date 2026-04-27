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
  paysCodeAvecTrace,
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
const paysFallbacks = [];

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

  const {
    code: codePays,
    fallback: paysFallback,
    raison: paysRaison,
  } = paysCodeAvecTrace(ligne.pays);
  if (paysFallback) {
    paysFallbacks.push({ ligne: index, libelleSource: ligne.pays ?? '', raison: paysRaison });
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
// 3. Insertion ligne par ligne via RPC upsert_structure_import
//    (cf. migration 019 hotfix v1.2.6 — index partiel)
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
  const { data, error } = await supabase.rpc('upsert_structure_import', {
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

  if ((i + 1) % 50 === 0 || i === aInserer.length - 1) {
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
console.log('RAPPORT D\u2019IMPORT — STRUCTURES');
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
  console.log('\nDétail des erreurs SQL (10 premières) :');
  for (const e of erreursInsert.slice(0, 10)) {
    console.log(`  • ligne ${e.index} : ${e.message}`);
  }
  if (erreursInsert.length > 10) {
    console.log(`  … et ${erreursInsert.length - 10} autres`);
  }
}

process.exit(erreursInsert.length > 0 ? 1 : 0);
