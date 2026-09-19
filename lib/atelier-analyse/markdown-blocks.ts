/**
 * Analyseur Markdown partagé par les exports Word et PDF du rapport IA.
 * Reconnaît titres (#, ##, ###), listes (-, *, •), tableaux Markdown, blocs de
 * graphiques ```chart {json}``` et paragraphes. Le gras **…** est retiré.
 */

export type BlocMd =
  | { type: 'h1' | 'h2' | 'h3'; texte: string }
  | { type: 'p'; texte: string }
  | { type: 'li'; texte: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'chart'; spec: string };

function nettoyerInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Découpe une ligne de tableau Markdown « | a | b | » en cellules nettoyées. */
function cellulesLigne(ligne: string): string[] {
  let s = ligne.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => nettoyerInline(c));
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
      // i pointe sur la clôture ``` (ou fin) ; la boucle for l'incrémentera.
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
      blocs.push({ type, texte: nettoyerInline(h[2] ?? '') });
      continue;
    }
    const li = /^\s*[-*•]\s+(.*)$/.exec(ligne);
    if (li) {
      blocs.push({ type: 'li', texte: nettoyerInline(li[1] ?? '') });
      continue;
    }
    blocs.push({ type: 'p', texte: nettoyerInline(ligne) });
  }
  return blocs;
}
