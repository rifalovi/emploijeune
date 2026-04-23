'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROGRAMMES_STRATEGIQUES, programmeStrategiqueDuProjet } from '@/lib/design/oif/programmes';
import type { Nomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { cn } from '@/lib/utils';

/**
 * Bandeau affiché lors d'une saisie à la chaîne (Q1=B) — signale les valeurs
 * pré-remplies depuis la fiche précédente et permet de les effacer.
 *
 * Design :
 *   - Bordure gauche colorée selon le PS du projet pré-rempli (continuité
 *     visuelle avec la liste bénéficiaires)
 *   - Récap textuel des 4 champs clés : projet, pays, domaine, année
 *   - Bouton « Réinitialiser » qui pointe vers /beneficiaires/nouveau sans
 *     query string (retrait des cohorte_*)
 *
 * Ne s'affiche que si au moins `cohorte_projet` est présent dans l'URL.
 */

export type RepriseApresEnregistrementProps = {
  cohorteProjet: string | undefined;
  cohortePays: string | undefined;
  cohorteDomaine: string | undefined;
  cohorteAnnee: number | undefined;
  nomenclatures: Nomenclatures;
};

export function RepriseApresEnregistrement({
  cohorteProjet,
  cohortePays,
  cohorteDomaine,
  cohorteAnnee,
  nomenclatures,
}: RepriseApresEnregistrementProps) {
  const pathname = usePathname();

  if (!cohorteProjet) return null;

  const ps = programmeStrategiqueDuProjet(cohorteProjet);
  const couleurBordure = ps ? PROGRAMMES_STRATEGIQUES[ps].principale : 'transparent';

  const projetLibelle = nomenclatures.projets.get(cohorteProjet)?.libelle;
  const paysLibelle = cohortePays ? nomenclatures.pays.get(cohortePays) : undefined;
  const domaineLibelle = cohorteDomaine ? nomenclatures.domaines.get(cohorteDomaine) : undefined;

  return (
    <aside
      className="bg-muted/30 flex flex-col gap-3 rounded-lg border-l-4 p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeftColor: couleurBordure }}
      role="region"
      aria-label="Valeurs pré-remplies depuis la fiche précédente"
    >
      <div className="flex items-start gap-2">
        <Repeat aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Saisie à la chaîne active</p>
          <p className="text-muted-foreground text-xs">
            Les champs suivants sont pré-remplis depuis votre fiche précédente :
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
            {domaineLibelle && (
              <li>
                <span className="font-medium">Domaine :</span> {domaineLibelle}
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
