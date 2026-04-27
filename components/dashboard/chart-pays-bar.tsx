'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Bar chart Recharts horizontal — Top 10 pays par bénéficiaires (hotfix
 * v1.2.7). KPI clé pour la démo institutionnelle (« OIF présente dans
 * 51 pays francophones »).
 *
 * Couleur : PS1 officiel (#0198E9) — convention « pays » alignée sur le
 * bleu cyan OIF.
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
          {data.length} pays affichés — survolez une barre pour le détail
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 16, left: 60, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="libelle"
                tick={{ fontSize: 11 }}
                width={120}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(label) => {
                  const item = data.find((d) => d.libelle === label);
                  return item?.code ? `${label} (${item.code})` : String(label ?? '');
                }}
                formatter={(v) => [`${Number(v ?? 0)} bénéficiaire(s)`, ''] as [string, string]}
              />
              <Bar
                dataKey="beneficiaires"
                fill={PROGRAMMES_STRATEGIQUES.PS1.principale}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
