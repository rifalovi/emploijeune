'use client';

import { modifierAnalyse } from '@/lib/analyses-indicateurs/server-actions';
import { BoutonSauvegarder } from './boutons-actions';

/**
 * Éditeur inline d'une analyse brouillon (résumé + contenu Markdown).
 *
 * Côté client pour pouvoir intégrer `<BoutonSauvegarder />` qui utilise
 * `useFormStatus` (hook React qui ne fonctionne que dans un Client Component).
 *
 * Pattern "progressive disclosure" : l'éditeur n'est rendu côté page que
 * pour les analyses en statut "brouillon" — ne charge donc le JS qu'à
 * ce moment-là.
 */
export function EditeurAnalyse({
  analyse,
}: {
  analyse: { id: string; contenu: string; resume: string | null };
}) {
  return (
    <form action={modifierAnalyse} className="space-y-3">
      <input type="hidden" name="analyse_id" value={analyse.id} />
      <div>
        <label
          htmlFor={`resume-${analyse.id}`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Résumé (accroche — max 150 car.)
        </label>
        <input
          id={`resume-${analyse.id}`}
          name="resume"
          type="text"
          maxLength={150}
          defaultValue={analyse.resume ?? ''}
          className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0E4F88] focus:outline-none"
          placeholder="Accroche de l'analyse (optionnel)"
        />
      </div>
      <div>
        <label
          htmlFor={`contenu-${analyse.id}`}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          Contenu (Markdown)
        </label>
        <textarea
          id={`contenu-${analyse.id}`}
          name="contenu"
          rows={12}
          defaultValue={analyse.contenu}
          className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs focus:border-[#0E4F88] focus:outline-none"
          placeholder="Contenu en Markdown…"
        />
      </div>
      <div className="flex justify-end">
        <BoutonSauvegarder />
      </div>
    </form>
  );
}
