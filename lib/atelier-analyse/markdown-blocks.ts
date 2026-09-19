/**
 * Analyseur Markdown partagé par les exports Word et PDF du rapport IA.
 * Reconnaît titres (#..######), listes (-, *, •), citations (>), tableaux
 * Markdown, blocs de graphiques ```chart {json}``` et paragraphes. Les marques
 * de style en ligne (**gras**, *italique*, `code`) sont CONSERVÉES et exposées
 * via `inlineTokens()` pour un rendu fidèle (gras des chiffres clés, etc.).
 */

export type BlocMd =
  | { type: 'h1' | 'h2' | 'h3'; texte: string }
  | { type: 'p'; texte: string }
  | { type: 'li'; texte: string }
  | { type: 'quote'; texte: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'chart'; spec: string };

/** Fragment de texte en ligne avec son style (gras / italique / code). */
export type InlineTok = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

/**
 * Découpe un texte en fragments stylés : **gras**, *italique* et `code`.
 * Simple mais suffisant pour les rapports (pas d'imbrication complexe).
 */
export function inlineTokens(s: string): InlineTok[] {
  const out: InlineTok[] = [];
  const re = /\*\*([^*]+?)\*\*|`([^`]+?)`|(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], code: true });
    else if (m[3] !== undefined) out.push({ text: m[3], italic: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out.length ? out : [{ text: s }];
}

/** Version texte simple (marques retirées) — pour titres et cellules. */
function texteSimple(s: string): string {
  return inlineTokens(s)
    .map((t) => t.text)
    .join('')
    .trim();
}

/** Découpe une ligne de tableau Markdown « | a | b | » en cellules. */
function cellulesLigne(ligne: string): string[] {
  let s = ligne.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => texteSimple(c));
}

/** Vrai si la ligne est un séparateur d'en-tête de tableau : | --- | :--: | */
function estSeparateurTableau(ligne: string): boolean {
  const s = ligne.trim();
  if (!s.includes('|') || !s.includes('-')) return false;
  return cellulesLigne(s).every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));
}

export function parseMarkdown(markdown: string): BlocMd[] {
  const blocs: BlocMd[] = [];
  const lignes = markdown.split('\n');

  for (let i = 0; i < lignes.length; i += 1) {
    const brute = lignes[i] ?? '';
    const ligne = brute.trimEnd();
    const trimmed = ligne.trimStart();

    // Bloc de code : ```chart …``` devient un graphique ; les autres sont ignorés.
    if (trimmed.startsWith('```')) {
      const estChart = /^```+\s*chart\b/i.test(trimmed);
      const contenu: string[] = [];
      i += 1;
      while (i < lignes.length && !(lignes[i] ?? '').trimStart().startsWith('```')) {
        contenu.push(lignes[i] ?? '');
        i += 1;
      }
      if (estChart && contenu.join('').trim()) {
        blocs.push({ type: 'chart', spec: contenu.join('\n') });
      }
      continue;
    }

    if (!ligne.trim()) continue;

    // Tableau Markdown : ligne d'en-tête suivie d'un séparateur, puis le corps.
    if (ligne.includes('|') && i + 1 < lignes.length && estSeparateurTableau(lignes[i + 1] ?? '')) {
      const headers = cellulesLigne(ligne);
      const rows: string[][] = [];
      i += 2; // saute l'en-tête + séparateur
      while (i < lignes.length && (lignes[i] ?? '').trim().includes('|')) {
        const l = (lignes[i] ?? '').trim();
        if (!l) break;
        rows.push(cellulesLigne(l));
        i += 1;
      }
      i -= 1; // compense l'incrément de la boucle for
      blocs.push({ type: 'table', headers, rows });
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(ligne);
    if (h) {
      const niveau = h[1]!.length;
      const type = niveau === 1 ? 'h1' : niveau === 2 ? 'h2' : 'h3';
      blocs.push({ type, texte: texteSimple(h[2] ?? '') });
      continue;
    }
    const cite = /^\s*>\s?(.*)$/.exec(ligne);
    if (cite) {
      blocs.push({ type: 'quote', texte: (cite[1] ?? '').trim() });
      continue;
    }
    const li = /^\s*[-*•]\s+(.*)$/.exec(ligne);
    if (li) {
      blocs.push({ type: 'li', texte: (li[1] ?? '').trim() });
      continue;
    }
    blocs.push({ type: 'p', texte: ligne.trim() });
  }
  return blocs;
}
