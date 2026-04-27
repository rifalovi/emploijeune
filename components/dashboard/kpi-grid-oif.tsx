import { Users, GraduationCap, Building2, Briefcase, Globe2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IndicateursOif } from '@/lib/kpis/indicateurs-oif';

/**
 * Grille des 5 indicateurs OIF stratégiques V1 : A1 / A4 / B1 / B4 / F1.
 *
 * A4 et F1 affichent un placeholder « Phase 2 — Diapo D2/D3 » car ils
 * dépendent des questionnaires longitudinaux non encore alimentés en V1.
 */
export function KpiGridOif({ data }: { data: IndicateursOif }) {
  const i = data.indicateurs;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCardOif
        code="A1"
        libelle={i.A1.libelle}
        valeur={i.A1.valeur}
        icone={GraduationCap}
        details={
          i.A1.femmes !== undefined && i.A1.hommes !== undefined
            ? `${i.A1.femmes} femmes · ${i.A1.hommes} hommes`
            : null
        }
      />
      <KpiCardOif
        code="A4"
        libelle={i.A4.libelle}
        valeur={i.A4.valeur}
        icone={Users}
        proxy={i.A4.proxy}
      />
      <KpiCardOif code="B1" libelle={i.B1.libelle} valeur={i.B1.valeur} icone={Building2} />
      <KpiCardOif
        code="B4"
        libelle={i.B4.libelle}
        valeur={i.B4.valeur}
        icone={Briefcase}
        details={i.B4.mention ?? null}
      />
      <KpiCardOif
        code="F1"
        libelle={i.F1.libelle}
        valeur={i.F1.valeur}
        icone={Globe2}
        proxy={i.F1.proxy}
      />
    </div>
  );
}

function KpiCardOif({
  code,
  libelle,
  valeur,
  icone: Icone,
  details = null,
  proxy = null,
}: {
  code: string;
  libelle: string;
  valeur: number | null;
  icone: typeof Users;
  details?: string | null;
  proxy?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-0.5">
          <Badge variant="outline" className="font-mono text-xs">
            {code}
          </Badge>
          <CardTitle className="text-sm leading-tight font-medium">{libelle}</CardTitle>
        </div>
        <Icone aria-hidden className="text-muted-foreground size-5 shrink-0" />
      </CardHeader>
      <CardContent>
        {valeur !== null ? (
          <>
            <div className="text-2xl font-semibold tabular-nums">
              {valeur.toLocaleString('fr-FR')}
            </div>
            {details && <p className="text-muted-foreground mt-1 text-xs">{details}</p>}
          </>
        ) : (
          <div className="border-muted text-muted-foreground rounded-md border border-dashed p-2 text-xs">
            <span className="font-medium">À venir</span>
            {proxy && <p className="mt-0.5">{proxy}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
