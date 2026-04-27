'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { tooltipPropsPremium } from '@/lib/design/charts';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Bar chart Recharts — top 10 projets par bénéficiaires (V1.6.0 polish).
 *
 * Polish v1.6.0 :
 *   - Couleurs variées : 1er bar bleu OIF foncé, dégradé vers couleurs PS
 *     officielles selon le ranking. Effet « podium » visuel.
 *   - Tooltip premium (fond sombre + texte blanc lisible).
 *   - Marges ajustées pour éviter chevauchement labels.
 */
export function ChartProjetsBar({ data }: { data: Donnee[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top projets par bénéficiaires</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center text-sm italic">
          Aucun bénéficiaire dans le périmètre sélectionné.
        </CardContent>
      </Card>
    );
  }

  // Palette « podium » : 1er = bleu OIF institutionnel, puis cycle sur les
  // couleurs PS officielles avec opacité descendante pour le ranking.
  const PALETTE = [
    '#0E4F88', // 1 : bleu institutionnel OIF
    PROGRAMMES_STRATEGIQUES.PS3.principale, // 2 : vert PS3
    PROGRAMMES_STRATEGIQUES.PS1.principale, // 3 : cyan PS1
    PROGRAMMES_STRATEGIQUES.PS2.principale, // 4 : violet PS2
    '#F5A623', // 5 : doré accent
  ];
  const couleurPour = (i: number) => {
    const couleur = PALETTE[i % PALETTE.length] ?? '#0E4F88';
    // Pour les positions au-delà du top 5, ajout d'une opacité dégressive
    if (i < 5) return couleur;
    return `${couleur}b3`; // 70% opacity hex
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top projets par bénéficiaires</CardTitle>
        <CardDescription>
          {data.length} projet(s) actif(s) : survolez une barre pour le détail
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="code"
                angle={-35}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 11, fill: '#374151' }}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                {...tooltipPropsPremium}
                cursor={{ fill: 'rgba(14, 79, 136, 0.08)' }}
                labelFormatter={(label) => {
                  const code = String(label ?? '');
                  const item = data.find((d) => d.code === code);
                  return item?.libelle ? `${code} : ${item.libelle}` : code;
                }}
                formatter={(v) => [`${Number(v ?? 0)} bénéficiaire(s)`, ''] as [string, string]}
              />
              <Bar dataKey="beneficiaires" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={d.code} fill={couleurPour(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
