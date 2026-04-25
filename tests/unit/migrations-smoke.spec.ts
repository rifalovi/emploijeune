import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Smoke tests sur les migrations SQL Postgres (Étape 6h, 26/04/2026).
 *
 * Les migrations Supabase ne sont jamais exécutées par Vitest (pas de
 * connexion BDD en CI), donc les erreurs SQL passent à travers les filets.
 * Ces tests scannent statiquement les fichiers `.sql` à la recherche de
 * patterns connus pour planter en production sur un PG vanilla.
 *
 * Origine : hotfix 6h — la migration 006 utilisait `MIN(uuid_column)`,
 * non supporté nativement par PostgreSQL (`function min(uuid) does not
 * exist`). Carlos a dû arrêter son `supabase db push` et attendre un
 * correctif. Ces gardes-fous évitent que ce type de bug se reproduise
 * sur les futures fonctions SQL (Étapes 7, 8, 9).
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function listerMigrationsSQL(): Array<{ nom: string; contenu: string }> {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({
      nom: f,
      contenu: readFileSync(join(MIGRATIONS_DIR, f), 'utf8'),
    }));
}

/**
 * Liste des colonnes UUID connues dans le schéma. Toute ligne SQL
 * qui appelle MIN/MAX sur l'une de ces colonnes (sans cast ::text)
 * fera planter la migration en production.
 */
const COLONNES_UUID = [
  'beneficiaire_id',
  'structure_id',
  'projet_id',
  'organisation_id',
  'created_by',
  'updated_by',
  'deleted_by',
  'agent_collecte',
  'session_enquete_id',
  'auteur_id',
  'utilisateur_id',
  'user_id',
];

describe('Smoke tests migrations SQL', () => {
  const migrations = listerMigrationsSQL();

  it('au moins une migration trouvée (sanity check)', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('aucune migration n’utilise MIN/MAX sur une colonne UUID sans cast ::text', () => {
    const violations: Array<{ migration: string; ligne: number; texte: string }> = [];

    for (const { nom, contenu } of migrations) {
      const lignes = contenu.split('\n');
      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i]!;
        // Ignore les commentaires SQL (-- ... ou /* ... */)
        const sansCommentaire = l.replace(/--.*$/, '').trim();
        if (!sansCommentaire) continue;

        for (const col of COLONNES_UUID) {
          // Pattern : MIN(...col...) ou MAX(...col...) où ... ne contient pas ::text
          // On cherche l'agrégat suivi de la colonne sans cast text préalable.
          const regex = new RegExp(`\\b(MIN|MAX)\\s*\\(\\s*([a-zA-Z_]+\\.)?${col}\\s*\\)`, 'i');
          if (regex.test(sansCommentaire)) {
            violations.push({
              migration: nom,
              ligne: i + 1,
              texte: l.trim(),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.migration}:${v.ligne}\n    > ${v.texte}`).join('\n');
      throw new Error(
        `\nPostgreSQL ne supporte pas MIN/MAX nativement sur UUID.\n` +
          `Cast en TEXT obligatoire : MIN(col::text)::uuid\n` +
          `Pour les booléens d'inférence : utiliser BOOL_OR(col IS NOT NULL).\n\n` +
          `Violations détectées :\n${msg}`,
      );
    }
    expect(violations).toHaveLength(0);
  });

  it('chaque migration a un en-tête de commentaire descriptif (rejette migrations vides ou non documentées)', () => {
    for (const { nom, contenu } of migrations) {
      // Ignore le seed (s'il était dans migrations, ce qui n'est pas le cas)
      if (nom.includes('seed')) continue;
      const premieres = contenu.split('\n').slice(0, 5).join('\n');
      expect(premieres, `Migration ${nom} n'a pas d'en-tête commentaire`).toMatch(/^--/);
    }
  });

  it('migration 006 (lister_sessions_enquete) utilise les bons casts UUID', () => {
    const m006 = migrations.find((m) => m.nom.includes('lister_sessions_enquete'));
    expect(m006, 'Migration 006 introuvable').toBeDefined();
    expect(m006!.contenu).toMatch(/beneficiaire_id::text\)::uuid/);
    expect(m006!.contenu).toMatch(/structure_id::text\)::uuid/);
    expect(m006!.contenu).toMatch(/created_by::text\)::uuid/);
    expect(m006!.contenu).toMatch(/BOOL_OR\(re\.beneficiaire_id IS NOT NULL\)/);
  });
});
