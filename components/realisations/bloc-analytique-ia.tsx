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
 * Concept pédagogique — Rendu Markdown sans bibliothèque :
 * On parse manuellement les constructions Markdown courantes
 * (titres H3, gras, italique, listes) pour éviter d'ajouter
 * une dépendance `react-markdown` ou `marked` au bundle.
 * Pour un usage plus riche, on utiliserait `react-markdown` + `remark-gfm`.
 */
function MarkdownSimple({ contenu, couleur }: { contenu: string; couleur: string }) {
  const lignes = contenu.split('\n');
  const elements: React.ReactNode[] = [];
  let iListe: string[] = [];

  const viderListe = () => {
    if (iListe.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {iListe.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>,
      );
      iListe = [];
    }
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]!;

    if (ligne.startsWith('### ')) {
      viderListe();
      const texte = ligne.slice(4);
      elements.push(
        <h3
          key={i}
          className="mb-2 mt-4 text-sm font-bold first:mt-0"
          style={{ color: couleur }}
        >
          {texte}
        </h3>,
      );
    } else if (ligne.startsWith('## ')) {
      viderListe();
      const texte = ligne.slice(3);
      elements.push(
        <h3 key={i} className="mb-2 mt-4 text-sm font-bold first:mt-0" style={{ color: couleur }}>
          {texte}
        </h3>,
      );
    } else if (ligne.startsWith('- ') || ligne.startsWith('* ')) {
      iListe.push(ligne.slice(2));
    } else if (ligne.trim() === '') {
      viderListe();
    } else {
      viderListe();
      elements.push(
        <p
          key={i}
          className="mb-3 text-sm leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: formatInline(ligne) }}
        />,
      );
    }
  }
  viderListe();

  return <>{elements}</>;
}

/** Formate le gras (**texte**) et l'italique (*texte*) inline. */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
