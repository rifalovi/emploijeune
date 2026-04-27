import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Pencil, Building2, Users, Upload, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvenementActivite } from '@/lib/dashboard/activite-recente';

const ICONES = {
  beneficiaire_cree: Plus,
  beneficiaire_maj: Pencil,
  structure_cree: Building2,
  structure_maj: Building2,
  import: Upload,
} as const;

const COULEURS: Record<EvenementActivite['type'], string> = {
  beneficiaire_cree: 'text-emerald-600',
  beneficiaire_maj: 'text-amber-600',
  structure_cree: 'text-blue-600',
  structure_maj: 'text-blue-600',
  import: 'text-purple-600',
};

export function ActiviteRecenteFeed({
  evenements,
  periodeLibelle,
}: {
  evenements: EvenementActivite[];
  periodeLibelle: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Activité récente</CardTitle>
            <CardDescription>
              {evenements.length} évènement(s) · {periodeLibelle.toLowerCase()}
            </CardDescription>
          </div>
          <Users aria-hidden className="text-muted-foreground size-5" />
        </div>
      </CardHeader>
      <CardContent>
        {evenements.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm italic">
            Aucune activité dans cette période.
          </p>
        ) : (
          <ol className="divide-y">
            {evenements.map((e) => {
              const Icone = ICONES[e.type];
              const dateAbs = format(new Date(e.horodatage), 'd MMM yyyy à HH:mm', { locale: fr });
              const dateRel = formatDistanceToNow(new Date(e.horodatage), {
                addSuffix: true,
                locale: fr,
              });
              const ContenuPrincipal = (
                <div className="flex items-start gap-3 py-2">
                  <Icone aria-hidden className={`mt-0.5 size-4 shrink-0 ${COULEURS[e.type]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {e.libelle}
                      </Badge>
                      <span className="text-muted-foreground text-xs tabular-nums" title={dateAbs}>
                        {dateRel}
                      </span>
                    </div>
                    {e.detail && (
                      <p className="text-muted-foreground mt-0.5 truncate text-sm">{e.detail}</p>
                    )}
                  </div>
                  {e.href && (
                    <ChevronRight
                      aria-hidden
                      className="text-muted-foreground mt-1 size-4 shrink-0"
                    />
                  )}
                </div>
              );
              return (
                <li key={e.id}>
                  {e.href ? (
                    <Link
                      href={e.href}
                      className="hover:bg-muted/40 -mx-3 block rounded px-3 transition-colors"
                    >
                      {ContenuPrincipal}
                    </Link>
                  ) : (
                    <div className="-mx-3 px-3">{ContenuPrincipal}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
