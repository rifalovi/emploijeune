/**
 * Tests sur les helpers internes de ia-extractor.ts.
 *
 * Note : `extraireAvecIA` complète est integration (Claude API + Supabase
 * + mammoth/unpdf) — non testable unitairement sans mocker tout.
 * On teste ici le parser Claude + la normalisation des lignes brutes,
 * recopiés ciblément pour ne pas avoir à mocker server-only.
 */
import { describe, it, expect } from 'vitest';
import {
  normaliserCodePays,
  normaliserCodeProjet,
  normaliserDomaineFormation,
  normaliserSexe,
  normaliserTrancheAge,
} from '@/lib/imports/smart-mapper';

// Recopie ciblée du parser pour test isolé
function parserReponseClaude(texte: string): unknown[] | null {
  const matchJson = texte.match(/\[[\s\S]*\]/);
  if (!matchJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(matchJson[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((item) => item && typeof item === 'object');
}

// Recopie ciblée de la normalisation
type LigneBrute = {
  projet?: string | null;
  pays?: string | null;
  prenom?: string | null;
  nom?: string | null;
  sexe?: string | null;
  tranche_age?: string | null;
  domaine_formation?: string | null;
  annee_formation?: number | null;
};

function normaliserLigneExtraite(brute: LigneBrute) {
  const projet = normaliserCodeProjet(brute.projet);
  const pays = normaliserCodePays(brute.pays);
  const sexe = normaliserSexe(brute.sexe);
  const tranche = normaliserTrancheAge(brute.tranche_age);
  const domaine = normaliserDomaineFormation(brute.domaine_formation);

  const donnees: Record<string, unknown> = {
    'Code projet *': projet ?? brute.projet ?? null,
    'Code pays bénéficiaire *': pays ?? brute.pays ?? null,
    'Prénom *': brute.prenom ?? null,
    'Nom *': brute.nom ?? null,
    'Sexe *': sexe ?? brute.sexe ?? null,
    "Tranche d'âge déclarée": tranche,
    'Domaine de formation *': domaine ?? null,
    'Année de la formation *': brute.annee_formation ?? null,
  };

  let score = 0;
  let total = 0;
  if (projet) score += 25;
  total += 25;
  if (pays) score += 25;
  total += 25;
  if (brute.prenom) score += 10;
  total += 10;
  if (brute.nom) score += 10;
  total += 10;
  if (sexe) score += 10;
  total += 10;
  if (domaine || tranche) score += 10;
  total += 10;
  if (brute.annee_formation) score += 10;
  total += 10;

  return { donnees, confiance: total > 0 ? Math.round((score / total) * 100) : 0 };
}

describe('parserReponseClaude — Phase 2 import IA', () => {
  it('parse un tableau JSON propre', () => {
    const texte = `[{"projet": "P14", "pays": "Mali", "prenom": "Aïcha", "sexe": "F"}]`;
    const r = parserReponseClaude(texte);
    expect(r).toHaveLength(1);
    expect((r?.[0] as { projet: string })?.projet).toBe('P14');
  });

  it('extrait un tableau enrobé de markdown', () => {
    const texte = `Voici le résultat :\n\`\`\`json\n[{"projet": "PROJ_A16a"}]\n\`\`\``;
    const r = parserReponseClaude(texte);
    expect(r).toHaveLength(1);
  });

  it('renvoie null pour réponse sans tableau', () => {
    expect(parserReponseClaude('Aucun bénéficiaire détecté')).toBeNull();
  });

  it('renvoie null pour JSON malformé', () => {
    expect(parserReponseClaude('[{broken}]')).toBeNull();
  });

  it('renvoie tableau vide si []', () => {
    expect(parserReponseClaude('[]')).toEqual([]);
  });

  it('filtre les non-objets', () => {
    const r = parserReponseClaude('[null, 42, {"projet": "P14"}, "x"]');
    expect(r).toHaveLength(1);
  });
});

describe('normaliserLigneExtraite — Phase 2 import IA', () => {
  it('normalise une ligne complète et bien formée', () => {
    const ligne = normaliserLigneExtraite({
      projet: 'P14',
      pays: 'Cameroun',
      prenom: 'Awa',
      nom: 'TRAORE',
      sexe: 'F',
      tranche_age: 'Jeune',
      domaine_formation: 'numérique',
      annee_formation: 2024,
    });
    expect(ligne.donnees['Code projet *']).toBe('PROJ_A14');
    expect(ligne.donnees['Code pays bénéficiaire *']).toBe('CMR');
    expect(ligne.donnees['Sexe *']).toBe('F');
    expect(ligne.donnees["Tranche d'âge déclarée"]).toBe('Jeune');
    expect(ligne.donnees['Domaine de formation *']).toBe('NUM_INFO');
    expect(ligne.confiance).toBe(100);
  });

  it('confiance dégradée si champs manquants', () => {
    const ligne = normaliserLigneExtraite({
      projet: 'P14',
      pays: 'Cameroun',
      prenom: null,
      nom: null,
      sexe: null,
      tranche_age: null,
      domaine_formation: null,
      annee_formation: null,
    });
    // Seuls projet (25) + pays (25) = 50/100
    expect(ligne.confiance).toBe(50);
  });

  it('garde la valeur brute en cas de non-reconnaissance', () => {
    const ligne = normaliserLigneExtraite({
      projet: 'PROJET_INEXISTANT_XYZ',
      pays: 'PaysInconnu',
    });
    expect(ligne.donnees['Code projet *']).toBe('PROJET_INEXISTANT_XYZ');
    expect(ligne.donnees['Code pays bénéficiaire *']).toBe('PaysInconnu');
    expect(ligne.confiance).toBe(0);
  });
});
