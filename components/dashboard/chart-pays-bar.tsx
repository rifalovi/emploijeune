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
import { couleurRang, tooltipPropsPremium } from '@/lib/design/charts';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Bar chart Recharts horizontal — Top 10 pays par bénéficiaires (V1.6.0).
 *
 * Polish v1.6.0 :
 *   - Effet « podium » avec couleurs variées (1er bleu OIF, puis PS officielles).
 *   - Tooltip premium fond bleu OIF + texte blanc.
 *   - Cursor highlight subtil.
 *   - Axes adoucis (sans lignes intrusives).
 */
export function ChartPaysBar({ data }: { data: Donnee[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 pays par bénéficiaires</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center text-sm italic">
          Aucun bénéficiaire dans le périmètre sélectionné.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 10 pays par bénéficiaires</CardTitle>
        <CardDescription>
          {data.length} pays affichés : effet podium par couleur de rang
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 24, left: 80, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                type="category"
                dataKey="libelle"
                tick={{ fontSize: 11, fill: '#374151' }}
                width={140}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                {...tooltipPropsPremium}
                cursor={{ fill: 'rgba(14, 79, 136, 0.06)' }}
                labelFormatter={(label) => {
                  const item = data.find((d) => d.libelle === label);
                  return item?.code ? `${label} (${item.code})` : String(label ?? '');
                }}
                formatter={(v) =>
                  [`${Number(v ?? 0).toLocaleString('fr-FR')} bénéficiaire(s)`, ''] as [
                    string,
                    string,
                  ]
                }
              />
              <Bar dataKey="beneficiaires" radius={[0, 6, 6, 0]}>
                {data.map((d, i) => (
                  <Cell key={d.code} fill={couleurRang(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
