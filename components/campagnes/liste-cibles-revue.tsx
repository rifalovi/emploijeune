'use client';

import { Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ListerStrateLigne } from '@/lib/campagnes/server-actions';

/**
 * Liste paginée des cibles avec checkboxes pour révision/sélection (V1.5.1).
 *
 * Composant 100% présentationnel — la logique de chargement et de sélection
 * est tenue par le wizard parent. Réutilisé pour :
 *   - Mode « manuelle » : commence vide, l'utilisateur coche manuellement.
 *   - Mode « filtres » : tout coché par défaut, l'utilisateur peut décocher
 *     individuellement (cas d'usage terrain : exclure un contact rompu, un
 *     doublon non détecté, une personne décédée…).
 *
 * Affiche un message d'aide différent selon le mode pour guider l'admin.
 */

export type ListeCiblesRevueProps = {
  /** Lignes de la page courante (déjà chargées par le parent). */
  lignes: ListerStrateLigne[];
  /** Sélection courante (UUID des cibles cochées). */
  selection: Set<string>;
  /** Toggle d'une cible individuelle. */
  onToggleCible: (id: string) => void;
  /** Toggle « tout (dé)cocher cette page ». */
  onToggleTouteLaPage: () => void;
  /** Recherche full-text courante. */
  recherche: string;
  onRechercheChange: (q: string) => void;
  /** Pagination. */
  page: number;
  totalPages: number;
  totalEligibles: number;
  onPageChange: (page: number) => void;
  /** Indicateur de chargement (RPC en cours). */
  pending: boolean;
  /** Mode courant pour adapter le message d'aide. */
  mode: 'manuelle' | 'filtres';
};

export function ListeCiblesRevue({
  lignes,
  selection,
  onToggleCible,
  onToggleTouteLaPage,
  recherche,
  onRechercheChange,
  page,
  totalPages,
  totalEligibles,
  onPageChange,
  pending,
  mode,
}: ListeCiblesRevueProps) {
  const idsPage = lignes.map((l) => l.id);
  const tousCoches = idsPage.length > 0 && idsPage.every((id) => selection.has(id));
  const auMoinsUnDecoche = idsPage.some((id) => !selection.has(id));

  const messageAide =
    mode === 'manuelle'
      ? 'Cochez les cibles que vous souhaitez inclure dans cette campagne.'
      : 'Toutes les cibles éligibles aux filtres sont cochées. Décochez celles à exclure (contact rompu, doublon, etc.) avant le lancement.';

  return (
    <div className="space-y-3 rounded-md border p-3">
      {/* Aide contextuelle */}
      <p className="text-muted-foreground text-xs">{messageAide}</p>

      {/* Recherche + compteur */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            value={recherche}
            onChange={(e) => onRechercheChange(e.target.value)}
            placeholder="Rechercher un nom ou un email…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-col items-end gap-0.5 text-sm">
          <span className="font-medium">
            {selection.size.toLocaleString('fr-FR')} cochée(s) sur{' '}
            {totalEligibles.toLocaleString('fr-FR')} éligibles
          </span>
          {mode === 'filtres' && selection.size < totalEligibles && (
            <span className="text-xs text-amber-600">
              {(totalEligibles - selection.size).toLocaleString('fr-FR')} cible(s) exclue(s)
              manuellement
            </span>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="w-10 p-2">
                <input
                  type="checkbox"
                  aria-label={tousCoches ? 'Décocher toute la page' : 'Cocher toute la page'}
                  checked={tousCoches}
                  ref={(el) => {
                    if (el) el.indeterminate = !tousCoches && !auMoinsUnDecoche === false;
                  }}
                  onChange={onToggleTouteLaPage}
                />
              </th>
              <th className="p-2 text-left">Cible</th>
              <th className="p-2 text-left">Projet</th>
              <th className="p-2 text-left">Pays</th>
              <th className="p-2 text-left">Email</th>
            </tr>
          </thead>
          <tbody>
            {pending ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center text-xs">
                  <Loader2 className="inline size-4 animate-spin" /> Chargement…
                </td>
              </tr>
            ) : lignes.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center text-xs italic">
                  {recherche
                    ? `Aucune cible ne correspond à « ${recherche} ».`
                    : 'Aucune cible éligible.'}
                </td>
              </tr>
            ) : (
              lignes.map((l) => {
                const coche = selection.has(l.id);
                const emailAffichable =
                  l.email && !l.email.includes('@import-oif-2025.local') ? l.email : null;
                return (
                  <tr key={l.id} className="hover:bg-muted/30 border-t">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() => onToggleCible(l.id)}
                        aria-label={coche ? `Décocher ${l.libelle}` : `Cocher ${l.libelle}`}
                      />
                    </td>
                    <td className="p-2">{l.libelle}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {l.projet_code}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">{l.pays_code}</td>
                    <td className="text-muted-foreground max-w-[220px] truncate p-2 text-xs">
                      {emailAffichable ?? <span className="italic">— sans email valide</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          Page {page + 1} sur {totalPages}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0 || pending}
          >
            Précédent
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page + 1 >= totalPages || pending}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
