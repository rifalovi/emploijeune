'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { RepartitionTrancheAge } from '@/lib/landing/queries';

const COULEUR_JEUNE = '#0198E9'; // PS1 cyan – jeunes 18-34
const COULEUR_ADULTE = '#5D0073'; // PS2 violet – adultes 35+
const COULEUR_NR = '#e2e8f0'; // gris clair – non renseigné

/**
 * Widget répartition Jeune / Adulte (tranche_age_declaree).
 *
 * Affiche :
 *   - Barre horizontale empilée (Jeune / Adulte / Non renseigné)
 *   - Compteurs détaillés en dessous
 *   - Badge « Indicateur clé » OIF
 *
 * Indicateur important : la définition OIF distingue « Jeunes (18-34 ans) »
 * cibles prioritaires et « Adultes (35 ans et +) ».
 */
export function ChartTrancheAge({ data }: { data: RepartitionTrancheAge }) {
  const { jeunes, adultes, non_renseigne, total, jeunes_pct, adultes_pct } = data;
  const nr_pct = total > 0 ? Math.round((non_renseigne / total) * 100) : 0;

  const segments = [
    { label: 'Jeunes (18-34 ans)', valeur: jeunes, pct: jeunes_pct, couleur: COULEUR_JEUNE },
    { label: 'Adultes (35 ans et +)', valeur: adultes, pct: adultes_pct, couleur: COULEUR_ADULTE },
    ...(non_renseigne > 0
      ? [{ label: 'Non renseigné', valeur: non_renseigne, pct: nr_pct, couleur: COULEUR_NR }]
      : []),
  ];

  const LARGEUR_MIN = 4; // % minimum pour rester visible

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${COULEUR_JEUNE}1a` }}
            >
              <Users className="size-4" style={{ color: COULEUR_JEUNE }} aria-hidden />
            </div>
            <CardTitle className="text-base">Répartition par tranche d&apos;âge</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ color: COULEUR_JEUNE, borderColor: `${COULEUR_JEUNE}55` }}
          >
            Indicateur clé OIF
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {total.toLocaleString('fr-FR')} bénéficiaires · Catégories selon le Cadre Commun
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barre empilée */}
        <div
          className="overflow-hidden rounded-full"
          style={{ height: 20, background: COULEUR_NR }}
        >
          <div className="flex h-full">
            {segments.map((seg) => {
              const largeur = Math.max(seg.pct, seg.valeur > 0 ? LARGEUR_MIN : 0);
              return (
                <div
                  key={seg.label}
                  title={`${seg.label} : ${seg.valeur.toLocaleString('fr-FR')} (${seg.pct}\u00a0%)`}
                  style={{ width: `${largeur}%`, backgroundColor: seg.couleur }}
                  className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                />
              );
            })}
          </div>
        </div>

        {/* Légende détaillée */}
        <div className="grid grid-cols-2 gap-3">
          {segments
            .filter((s) => s.couleur !== COULEUR_NR)
            .map((seg) => (
              <div key={seg.label} className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={{ backgroundColor: seg.couleur }}
                  />
                  <span className="text-xs font-medium text-slate-700">{seg.label}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: seg.couleur }}>
                    {seg.valeur.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-muted-foreground mb-0.5 text-xs tabular-nums">
                    {seg.pct}\u00a0%
                  </span>
                </div>
              </div>
            ))}
        </div>

        {non_renseigne > 0 && (
          <p className="text-muted-foreground text-xs">
            {non_renseigne.toLocaleString('fr-FR')} sans tranche déclarée (saisie manuelle sans date
            de naissance)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
