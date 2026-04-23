import Link from 'next/link';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  titre: string;
  valeur: string | number;
  sousTexte: string;
  icone?: LucideIcon;
  href?: string;
  alerte?: boolean;
  badgeTexte?: string;
};

export function KpiCard({
  titre,
  valeur,
  sousTexte,
  icone: Icone,
  href,
  alerte,
  badgeTexte,
}: KpiCardProps) {
  const content = (
    <Card
      className={cn(
        'h-full transition-shadow',
        href && 'hover:border-foreground/20 hover:shadow-md',
        alerte && 'border-destructive/40',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">{titre}</CardTitle>
          {Icone && <Icone aria-hidden className="text-muted-foreground size-4" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tracking-tight">{valeur}</p>
          {alerte && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle aria-hidden className="size-3" />
              {badgeTexte ?? 'Action'}
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1">{sousTexte}</CardDescription>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="focus-visible:ring-ring block rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  }
  return content;
}
