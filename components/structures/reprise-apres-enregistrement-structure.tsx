'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROGRAMMES_STRATEGIQUES, programmeStrategiqueDuProjet } from '@/lib/design/oif/programmes';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { cn } from '@/lib/utils';

/**
 * Bandeau « saisie à la chaîne » pour la création de structure (B1).
 * Identique en esprit au composant A1 mais affiche les 6 champs hérités
 * d'une cohorte structures (projet, pays, secteur, nature appui, devise,
 * année).
 */

export type RepriseApresEnregistrementStructureProps = {
  cohorteProjet: string | undefined;
  cohortePays: string | undefined;
  cohorteSecteurActivite: string | undefined;
  cohorteNatureAppui: string | undefined;
  cohorteDevise: string | undefined;
  cohorteAnnee: number | undefined;
  nomenclatures: Nomenclatures;
};

export function RepriseApresEnregistrementStructure({
  cohorteProjet,
  cohortePays,
  cohorteSecteurActivite,
  cohorteNatureAppui,
  cohorteDevise,
  cohorteAnnee,
  nomenclatures,
}: RepriseApresEnregistrementStructureProps) {
  const pathname = usePathname();

  if (!cohorteProjet) return null;

  const ps = programmeStrategiqueDuProjet(cohorteProjet);
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';

  const projetLibelle = nomenclatures.projets.get(cohorteProjet)?.libelle;
  const paysLibelle = cohortePays ? nomenclatures.pays.get(cohortePays) : undefined;
  const secteurLibelle = cohorteSecteurActivite
    ? nomenclatures.secteursActivite.get(cohorteSecteurActivite)
    : undefined;
  const natureLibelle = cohorteNatureAppui
    ? nomenclatures.naturesAppui.get(cohorteNatureAppui)
    : undefined;

  return (
    <aside
      className="bg-muted/30 flex flex-col gap-3 rounded-lg border-l-4 p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeftColor: couleurBordure }}
      role="region"
      aria-label="Valeurs pré-remplies depuis la structure précédente"
    >
      <div className="flex items-start gap-2">
        <Repeat aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Saisie à la chaîne active</p>
          <p className="text-muted-foreground text-xs">
            Les champs suivants sont pré-remplis depuis votre structure précédente :
          </p>
          <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <li>
              <span className="font-medium">Projet :</span>{' '}
              <span className={cn('font-mono text-xs')}>
                {cohorteProjet}
                {projetLibelle && ` — ${projetLibelle}`}
              </span>
            </li>
            {paysLibelle && (
              <li>
                <span className="font-medium">Pays :</span> {paysLibelle}
              </li>
            )}
            {secteurLibelle && (
              <li>
                <span className="font-medium">Secteur :</span> {secteurLibelle}
              </li>
            )}
            {natureLibelle && (
              <li>
                <span className="font-medium">Nature appui :</span> {natureLibelle}
              </li>
            )}
            {cohorteDevise && (
              <li>
                <span className="font-medium">Devise :</span> {cohorteDevise}
              </li>
            )}
            {cohorteAnnee && (
              <li>
                <span className="font-medium">Année :</span> {cohorteAnnee}
              </li>
            )}
          </ul>
        </div>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={pathname} aria-label="Réinitialiser le pré-remplissage">
          <X className="size-3.5" aria-hidden />
          Réinitialiser le pré-remplissage
        </Link>
      </Button>
    </aside>
  );
}
