'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Bar chart Recharts — top 10 projets par nombre de bénéficiaires (Étape 9).
 * Données fournies par get_indicateurs_oif_v1, déjà triées et limitées en SQL.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top projets par bénéficiaires</CardTitle>
        <CardDescription>
          {data.length} projet(s) actif(s) — survolez une barre pour le détail
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="code"
                angle={-35}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(label) => {
                  const code = String(label ?? '');
                  const item = data.find((d) => d.code === code);
                  return item?.libelle ? `${code} — ${item.libelle}` : code;
                }}
                formatter={(v) => [`${Number(v ?? 0)} bénéficiaire(s)`, ''] as [string, string]}
              />
              <Bar dataKey="beneficiaires" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
