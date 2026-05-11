import { Sparkles, Bot, PenLine, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AnalyseIndicateurPublique } from '@/lib/analyses-indicateurs/queries';

/**
 * BlocAnalytiqueIA — Composant serveur public.
 *
 * Affiche l'analyse IA publiée pour un indicateur sur la page
 * /realisations/[pilier]/[indicateur].
 *
 * Comportement :
 *   - Si `analyse` est null → affiche un bloc "analyse en préparation"
 *   - Si `analyse` est présent → affiche le contenu Markdown rendu simplement
 *     avec un badge IA + date de mise à jour
 *
 * Concept pédagogique : ce composant est un "Server Component" pur — il ne
 * reçoit que des props sérialisables et ne contient aucun état client.
 * Le rendu Markdown est fait côté serveur via une conversion simple
 * (pas de dépendance externe) pour garder le bundle minimal.
 */

type Props = {
  analyse: AnalyseIndicateurPublique | null;
  couleur: string;
};

export function BlocAnalytiqueIA({ analyse, couleur }: Props) {
  return (
    <section className="mt-10">
      {/* En-tête section */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex size-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${couleur}18` }}
        >
          <Sparkles className="size-4" style={{ color: couleur }} aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-[#0E4F88]">Analyse de l&apos;indicateur</h2>
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${couleur}12`, color: couleur }}
        >
          <Bot className="size-3" aria-hidden />
          Propulsé par IA
        </span>
      </div>

      {analyse ? (
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: `${couleur}30`, backgroundColor: `${couleur}05` }}
        >
          {/* Résumé (accroche) */}
          {analyse.resume && (
            <p className="mb-4 text-sm font-medium leading-relaxed" style={{ color: couleur }}>
              {analyse.resume}
            </p>
          )}

          {/* Contenu Markdown rendu */}
          <div className="prose prose-sm max-w-none text-slate-700">
            <MarkdownSimple contenu={analyse.contenu} couleur={couleur} />
          </div>

          {/* Pied de bloc : badges méta */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            {analyse.genere_par_ia && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                <Bot className="size-3" aria-hidden />
                Généré par IA
              </span>
            )}
            {analyse.modifie_par_sa && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-600">
                <PenLine className="size-3" aria-hidden />
                Relu et validé
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="size-3" aria-hidden />
              Mis à jour{' '}
              {format(new Date(analyse.updated_at), 'd MMM yyyy', { locale: fr })}
            </span>
          </div>
        </div>
      ) : (
        /* Bloc vide — analyse pas encore générée */
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
          <Sparkles className="mx-auto mb-2 size-8 text-slate-300" aria-hidden />
          <p className="text-sm font-medium text-slate-500">Analyse en cours de préparation</p>
          <p className="mt-1 text-xs text-slate-400">
            L&apos;analyse IA de cet indicateur sera disponible prochainement.
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Rendu Markdown minimal (sans dépendance externe) ────────────────────────
/**
 * Rendu Markdown sans bibliothèque pour garder le bundle minimal.
 *
 * Constructions gérées :
 *   - `## Titre`, `### Titre`     → H3 stylé (les deux niveaux mappent H3
 *     car la section parent du bloc est déjà un H2)
 *   - `- item`, `* item`, `  - sub` → liste à puces plate (l'indentation
 *     éventuelle d'une sous-puce est aplatie pour rester lisible dans le
 *     bloc compact)
 *   - `**gras**` et `*italique*`  → <strong>/<em> inline
 *   - `> blockquote`              → paragraphe normal (préfixe `> ` retiré)
 *
 * Constructions ignorées (filtrées du rendu pour ne pas polluer l'UI) :
 *   - `---` / `***` / `___`       → lignes horizontales (Claude peut en
 *     insérer entre sections — on les supprime, la stylisation des H3
 *     suffit à séparer visuellement)
 *
 * Pour un rendu plus riche (tableaux, code, liens cliquables), on
 * basculerait sur `react-markdown` + `remark-gfm` (déjà dans deps pour
 * le chatbot). Mais ici on veut un rendu volontairement contrôlé.
 */
function MarkdownSimple({ contenu, couleur }: { contenu: string; couleur: string }) {
  const lignes = contenu.split('\n');
  const elements: React.ReactNode[] = [];
  let iListe: string[] = [];

  const viderListe = () => {
    if (iListe.length > 0) {
      elements.push(
        <ul
          key={`ul-${elements.length}`}
          className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-700"
        >
          {iListe.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>,
      );
      iListe = [];
    }
  };

  // Regex pré-compilées
  const ESTLISTE_RE = /^\s*[-*]\s+(.+)$/; // capture l'item sans le préfixe ni l'indentation
  const ESTHR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
  // Accepte H1 à H4 — Claude génère parfois un H1 unique en tête de
  // réponse ; sans cette tolérance le `#` resterait visible en texte brut.
  // Tous mappés sur H3 (le bloc parent porte déjà un H2).
  const ESTH3_RE = /^#{1,4}\s+(.+)$/;
  const ESTBLOCKQUOTE_RE = /^\s*>\s?(.*)$/;

  for (let i = 0; i < lignes.length; i++) {
    const brute = lignes[i]!;
    const ligne = brute.replace(/\s+$/, ''); // trim droite seulement

    // 1. Lignes horizontales — ignorer entièrement (jamais affichées)
    if (ESTHR_RE.test(ligne)) {
      viderListe();
      continue;
    }

    // 2. Titres ## ou ### — rendus uniformément en H3
    const matchTitre = ligne.match(ESTH3_RE);
    if (matchTitre) {
      viderListe();
      elements.push(
        <h3
          key={i}
          className="mb-2 mt-4 text-sm font-bold first:mt-0"
          style={{ color: couleur }}
        >
          {matchTitre[1]}
        </h3>,
      );
      continue;
    }

    // 3. Listes (avec ou sans indentation — aplaties)
    const matchListe = ligne.match(ESTLISTE_RE);
    if (matchListe) {
      iListe.push(matchListe[1]!);
      continue;
    }

    // 4. Blockquote — rendu comme paragraphe normal (préfixe retiré)
    const matchBQ = ligne.match(ESTBLOCKQUOTE_RE);
    if (matchBQ) {
      viderListe();
      const contenu = matchBQ[1]?.trim();
      if (contenu) {
        elements.push(
          <p
            key={i}
            className="mb-3 text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: formatInline(contenu) }}
          />,
        );
      }
      continue;
    }

    // 5. Ligne vide — sépare les blocs
    if (ligne.trim() === '') {
      viderListe();
      continue;
    }

    // 6. Paragraphe par défaut
    viderListe();
    elements.push(
      <p
        key={i}
        className="mb-3 text-sm leading-relaxed text-slate-700"
        dangerouslySetInnerHTML={{ __html: formatInline(ligne) }}
      />,
    );
  }
  viderListe();

  return <>{elements}</>;
}

/**
 * Formate le gras (**texte**) et l'italique (*texte*) inline.
 *
 * Ordre des regex important : gras d'abord (\*\*…\*\*) pour ne pas que
 * l'italique (\*…\*) ne capture la moitié d'un gras. Les regex sont
 * non-gourmandes (.+?) pour gérer plusieurs gras/italiques sur la même
 * ligne, et ancrées de telle sorte qu'un astérisque isolé reste tel quel.
 */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
}
