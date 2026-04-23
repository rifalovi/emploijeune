'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, Building2, ClipboardList, Search, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { KpiLecteur } from '@/lib/kpis/types';

const LOCAL_STORAGE_KEY = 'oif.dernieres_consultations';
const MAX_CONSULTATIONS = 5;

type Consultation = { href: string; label: string; visite_le: string };

export function DashboardLecteur({ data }: { data: KpiLecteur }) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setConsultations(parsed.slice(0, MAX_CONSULTATIONS) as Consultation[]);
      }
    } catch {
      // localStorage indisponible ou JSON invalide : on ignore silencieusement
    }
  }, []);

  const derniereMaj = data.derniere_maj
    ? format(new Date(data.derniere_maj), "d MMM yyyy 'à' HH:mm", { locale: fr })
    : 'aucune donnée';

  return (
    <div className="space-y-6">
      {/* Résumé de périmètre */}
      <div className="bg-muted/40 rounded-lg border p-4 text-sm">
        <p>
          Vous avez accès en lecture à <strong>{data.beneficiaires_visibles}</strong>{' '}
          bénéficiaire(s), <strong>{data.structures_visibles}</strong> structure(s), réparti(e)s sur{' '}
          <strong>{data.projets_couverts}</strong> projet(s) et{' '}
          <strong>{data.pays_couverts}</strong> pays.
        </p>
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <Clock aria-hidden className="size-3" /> Dernière mise à jour : {derniereMaj}
        </p>
      </div>

      {/* Recherche globale */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search aria-hidden className="size-4" />
            Recherche rapide
          </CardTitle>
          <CardDescription>
            Recherchez par nom de bénéficiaire ou de structure dans votre périmètre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/recherche" method="get" className="flex gap-2">
            <Input
              type="search"
              name="q"
              placeholder="Taper un nom…"
              aria-label="Rechercher"
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
            >
              Rechercher
            </button>
          </form>
        </CardContent>
      </Card>

      {/* 3 cartes de navigation rapide */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NavigationCard
          href="/beneficiaires"
          icone={Users}
          titre="Bénéficiaires"
          description={`${data.beneficiaires_visibles} visibles`}
        />
        <NavigationCard
          href="/structures"
          icone={Building2}
          titre="Structures"
          description={`${data.structures_visibles} visibles`}
        />
        <NavigationCard
          href="/enquetes"
          icone={ClipboardList}
          titre="Enquêtes"
          description="Consulter les réponses"
        />
      </div>

      {/* Dernières consultations */}
      {consultations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dernières consultations</CardTitle>
            <CardDescription>Sur cet appareil uniquement</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {consultations.map((c, i) => (
                <li key={`${c.href}-${i}`}>
                  <Link
                    href={c.href}
                    className="hover:bg-muted flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="truncate">{c.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(c.visite_le), 'd MMM', { locale: fr })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NavigationCard({
  href,
  icone: Icone,
  titre,
  description,
}: {
  href: string;
  icone: typeof Users;
  titre: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring block rounded-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:border-foreground/20 h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <Icone aria-hidden className="text-muted-foreground size-5" />
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{titre}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
