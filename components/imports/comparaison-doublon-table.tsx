'use client';

import { Check, XCircle } from 'lucide-react';

import type { ComparaisonDoublon } from '@/lib/imports/types';

/**
 * Tableau de correspondance champ par champ d'un doublon : montre, pour la
 * fiche importée (L{numéro}) vs la fiche existante, chaque champ comparé, s'il
 * correspond (✓ vert / ✗ rouge) et le pourcentage global de correspondance.
 *
 * Partagé par les deux rapports d'import (A1 bénéficiaires enrichi & B1
 * structures classique). Répond à la demande : « voir clairement toutes les
 * correspondances champ par champ quand on identifie le doublon ».
 */
export function ComparaisonDoublonTable({
  comparaison,
  numeroLigne,
}: {
  comparaison: ComparaisonDoublon;
  numeroLigne: number;
}) {
  const couleurPct =
    comparaison.pourcentage >= 80
      ? 'bg-red-100 text-red-700'
      : comparaison.pourcentage >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-2 py-1.5">
        <span className="text-[10px] font-medium text-slate-600">
          Correspondance L{numeroLigne} ↔ fiche existante
          {comparaison.reference ? ` (${comparaison.reference})` : ''} — critère :{' '}
          <span className="font-semibold">{comparaison.critere}</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${couleurPct}`}
        >
          {comparaison.pourcentage}% de correspondance
        </span>
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-white text-left text-slate-500">
            <th className="px-2 py-1 font-medium">Champ</th>
            <th className="px-2 py-1 font-medium">Valeur importée</th>
            <th className="px-2 py-1 font-medium">Fiche existante</th>
            <th className="w-8 px-2 py-1 text-center font-medium">=</th>
          </tr>
        </thead>
        <tbody>
          {comparaison.champs.map((c) => (
            <tr
              key={c.champ}
              className={`border-t border-slate-100 ${c.identique ? 'bg-emerald-50/40' : 'bg-red-50/40'}`}
            >
              <td className="px-2 py-1 font-medium text-slate-600">{c.champ}</td>
              <td className="px-2 py-1 font-mono text-slate-700">{c.valeur_importee ?? '—'}</td>
              <td className="px-2 py-1 font-mono text-slate-700">{c.valeur_existante ?? '—'}</td>
              <td className="px-2 py-1 text-center">
                {c.identique ? (
                  <Check className="mx-auto size-3 text-emerald-600" aria-label="identique" />
                ) : (
                  <XCircle className="mx-auto size-3 text-red-500" aria-label="différent" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
