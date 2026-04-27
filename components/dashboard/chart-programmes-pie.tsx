import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { cn } from '@/lib/utils';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Répartition bénéficiaires par programme stratégique (PS1/PS2/PS3) — V1.7.1.
 *
 * **Choix de visualisation : stacked bar horizontal** au lieu d'un pie
 * chart Recharts. Motivation :
 *   - La répartition réelle (PS3 ≈ 98 %, PS1 ≈ 1 %, PS2 ≈ 1 %) rend tout
 *     pie chart mathématiquement illisible : labels et tooltips se
 *     superposent en permanence, peu importe le filtre `<5 %`.
 *   - Une barre horizontale empilée occupe la même place visuelle, mais
 *     les segments minoritaires restent visibles (largeur minimale
 *     garantie, surlignage au survol), et les libellés sont en dessous
 *     dans une légende propre — zéro chevauchement possible.
 *   - Pure CSS + HTML : aucune dépendance Recharts, aucun risque de
 *     régression liée aux mises à jour de la lib graphique.
 *
 * Le nom du composant `ChartProgrammesPie` est conservé pour préserver
 * les imports existants (page dashboard).
 */

const COULEURS_PS: Record<string, string> = {
  PS1: PROGRAMMES_STRATEGIQUES.PS1.principale,
  PS2: PROGRAMMES_STRATEGIQUES.PS2.principale,
  PS3: PROGRAMMES_STRATEGIQUES.PS3.principale,
};

/**
 * Largeur visuelle minimale d'un segment (en %) pour rester perceptible
 * et survolable même quand sa part réelle est ≤ 1 %. Au-delà du seuil,
 * la largeur reflète la part réelle.
 */
const LARGEUR_MIN_SEGMENT_PCT = 4;

export function ChartProgrammesPie({ data }: { data: Donnee[] }) {
  const total = data.reduce((s, d) => s + d.beneficiaires, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par programme stratégique</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center text-sm italic">
          Aucun bénéficiaire dans le périmètre sélectionné.
        </CardContent>
      </Card>
    );
  }

  // Tri par effectif décroissant pour que le plus grand segment soit à gauche.
  const lignes = [...data]
    .sort((a, b) => b.beneficiaires - a.beneficiaires)
    .map((d) => {
      const pourcentageReel = (d.beneficiaires / total) * 100;
      return {
        ...d,
        pourcentageReel,
        couleur: COULEURS_PS[d.code] ?? '#94a3b8',
      };
    });

  // Largeur visuelle : on garantit un minimum pour les segments
  // minoritaires, puis on redistribue proportionnellement le reste.
  const segmentsMinoritaires = lignes.filter((l) => l.pourcentageReel < LARGEUR_MIN_SEGMENT_PCT);
  const reserveMinimum = segmentsMinoritaires.length * LARGEUR_MIN_SEGMENT_PCT;
  const totalMajoritaireReel = lignes
    .filter((l) => l.pourcentageReel >= LARGEUR_MIN_SEGMENT_PCT)
    .reduce((s, l) => s + l.pourcentageReel, 0);
  const espaceMajoritaireDispo = Math.max(0, 100 - reserveMinimum);

  const lignesAvecLargeur = lignes.map((l) => ({
    ...l,
    largeurVisuellePct:
      l.pourcentageReel < LARGEUR_MIN_SEGMENT_PCT
        ? LARGEUR_MIN_SEGMENT_PCT
        : totalMajoritaireReel > 0
          ? (l.pourcentageReel / totalMajoritaireReel) * espaceMajoritaireDispo
          : l.pourcentageReel,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Répartition par programme stratégique</CardTitle>
        <CardDescription>
          {total.toLocaleString('fr-FR')} bénéficiaire(s) · {data.length} programme(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stacked bar horizontal — pure CSS, zéro chevauchement possible */}
        <div className="flex h-12 w-full overflow-hidden rounded-lg shadow-inner ring-1 ring-slate-200">
          {lignesAvecLargeur.map((l, index) => {
            const pctArrondi = Math.round(l.pourcentageReel);
            const afficherLabelInterne = l.largeurVisuellePct >= 12; // au moins ~12% pour avoir la place
            return (
              <div
                key={l.code}
                title={`${l.code} — ${l.libelle ?? l.code} : ${l.beneficiaires.toLocaleString('fr-FR')} bénéficiaire(s) (${pctArrondi}%)`}
                className={cn(
                  'group relative flex items-center justify-center transition-all duration-300',
                  'hover:brightness-110',
                  index > 0 && 'border-l border-white/40',
                )}
                style={{
                  width: `${l.largeurVisuellePct}%`,
                  backgroundColor: l.couleur,
                }}
              >
                {afficherLabelInterne && (
                  <span className="px-2 text-xs font-semibold text-white tabular-nums drop-shadow-sm">
                    {pctArrondi}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Repère % minoritaires (segments < seuil largeur min) */}
        {segmentsMinoritaires.length > 0 && (
          <p className="text-muted-foreground mt-2 text-[11px] italic">
            Les segments minoritaires (&lt; {LARGEUR_MIN_SEGMENT_PCT} %) sont représentés à largeur
            minimale pour rester lisibles ; les pourcentages exacts figurent dans la légende
            ci-dessous.
          </p>
        )}

        {/* Légende structurée sous la barre */}
        <ul className="mt-5 space-y-2.5">
          {lignes.map((l) => (
            <li
              key={l.code}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-50"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full shadow-sm ring-2 ring-white"
                style={{ backgroundColor: l.couleur }}
              />
              <span
                className="font-mono text-xs font-semibold tabular-nums"
                style={{ color: l.couleur }}
              >
                {l.code}
              </span>
              <span className="flex-1 truncate text-slate-700">{l.libelle ?? l.code}</span>
              <span className="text-muted-foreground tabular-nums">
                {l.beneficiaires.toLocaleString('fr-FR')}
              </span>
              <span className="w-12 text-right font-semibold text-slate-900 tabular-nums">
                {Math.round(l.pourcentageReel)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
