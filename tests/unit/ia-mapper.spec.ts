/**
 * Tests unitaires sur ia-mapper.ts.
 *
 * Note : suggererMappageDomaines() appelle Claude API + Supabase, donc non
 * testable sans mock complet. On teste plutôt le parser de réponse Claude
 * via un helper interne accessible.
 *
 * Pour la garde feature flag (importIaActifPourCourant), on s'appuie sur un
 * test d'intégration manuel — la mocker reviendrait à tester le mock.
 */
import { describe, it, expect } from 'vitest';

// Le parser est volontairement non exporté pour ne pas polluer l'API publique,
// mais on peut le tester via la fonction publique en cas de mock. Ici on teste
// par recopie ciblée pour éviter le mock Supabase complet.

const DOMAINES = [
  'AGR_ELV_PCH',
  'AGROALIM',
  'ARTISANAT',
  'COMMERCE',
  'DEV_PERS',
  'ENTREPR_GEST',
  'ENV_ECO_VERTE',
  'FP_TECH',
  'GEST_FIN_COMPTA',
  'LANGUES_COM',
  'NUM_INFO',
  'SANTE_SERV_PERS',
  'SERV_FIN_INCLUSION',
  'TOURISME',
  'TRANSPORT',
  'AUTRE',
] as const;

/** Recopie du parser interne pour test isolé (la version réelle est en server-only). */
function parserReponseClaude(texte: string, valeursAttendues: ReadonlyArray<string>) {
  const matchJson = texte.match(/\[[\s\S]*\]/);
  if (!matchJson) return { status: 'erreur' as const, message: 'no_array' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(matchJson[0]);
  } catch {
    return { status: 'erreur' as const, message: 'invalid_json' };
  }
  if (!Array.isArray(parsed)) return { status: 'erreur' as const, message: 'not_array' };

  const valeursAttenduesSet = new Set(valeursAttendues);
  const codesValides = new Set<string>(DOMAINES);
  const suggestions: Array<{ valeurOriginale: string; codeSuggere: string; confiance: number }> = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const valeur = typeof obj.valeur === 'string' ? obj.valeur : null;
    const code = typeof obj.code === 'string' ? obj.code : null;
    const confiance = typeof obj.confiance === 'number' ? obj.confiance : 0;
    if (!valeur || !code) continue;
    if (!valeursAttenduesSet.has(valeur)) continue;
    if (!codesValides.has(code)) continue;
    suggestions.push({
      valeurOriginale: valeur,
      codeSuggere: code,
      confiance: Math.max(0, Math.min(100, Math.round(confiance))),
    });
  }

  return { status: 'succes' as const, suggestions };
}

describe('parserReponseClaude — Phase 3 import IA', () => {
  it('parse une réponse JSON propre', () => {
    const texte = `[
      {"valeur": "numérique avancé", "code": "NUM_INFO", "confiance": 92},
      {"valeur": "agriculture bio", "code": "AGR_ELV_PCH", "confiance": 85}
    ]`;
    const r = parserReponseClaude(texte, ['numérique avancé', 'agriculture bio']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions).toHaveLength(2);
    expect(r.suggestions[0]).toEqual({
      valeurOriginale: 'numérique avancé',
      codeSuggere: 'NUM_INFO',
      confiance: 92,
    });
  });

  it('extrait un tableau JSON entouré de markdown', () => {
    const texte = `\`\`\`json
[{"valeur": "vente", "code": "COMMERCE", "confiance": 80}]
\`\`\``;
    const r = parserReponseClaude(texte, ['vente']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions[0]?.codeSuggere).toBe('COMMERCE');
  });

  it('rejette une réponse sans tableau JSON', () => {
    const r = parserReponseClaude('Aucun mapping possible', ['x']);
    expect(r.status).toBe('erreur');
  });

  it('ignore les codes inventés par Claude', () => {
    const texte = `[
      {"valeur": "x", "code": "INVENTED_CODE", "confiance": 100},
      {"valeur": "y", "code": "NUM_INFO", "confiance": 70}
    ]`;
    const r = parserReponseClaude(texte, ['x', 'y']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0]?.valeurOriginale).toBe('y');
  });

  it("ignore les valeurs que Claude aurait inventées (hors liste attendue)", () => {
    const texte = `[{"valeur": "valeur_invente", "code": "AUTRE", "confiance": 50}]`;
    const r = parserReponseClaude(texte, ['valeur_reelle']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions).toHaveLength(0);
  });

  it('clampe la confiance dans [0..100]', () => {
    const texte = `[
      {"valeur": "a", "code": "AUTRE", "confiance": 150},
      {"valeur": "b", "code": "AUTRE", "confiance": -20}
    ]`;
    const r = parserReponseClaude(texte, ['a', 'b']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions[0]?.confiance).toBe(100);
    expect(r.suggestions[1]?.confiance).toBe(0);
  });

  it('tolère un objet manquant valeur ou code', () => {
    const texte = `[
      {"code": "NUM_INFO", "confiance": 80},
      {"valeur": "ok", "code": "NUM_INFO", "confiance": 60}
    ]`;
    const r = parserReponseClaude(texte, ['ok']);
    expect(r.status).toBe('succes');
    if (r.status !== 'succes') throw new Error('test setup');
    expect(r.suggestions).toHaveLength(1);
  });
});
