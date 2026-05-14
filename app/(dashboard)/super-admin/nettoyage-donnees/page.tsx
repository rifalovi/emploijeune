import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Eraser, ShieldAlert, Database } from 'lucide-react';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { NettoyageClient } from './nettoyage-client';
import { GARBAGE_EXACT } from '@/lib/imports/normalizer-garbage';

export const metadata: Metadata = {
  title: 'Nettoyage des données – OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

export default async function NettoyageDonneesPage() {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    redirect('/dashboard');
  }

  // Quelques exemples de patterns pour l'affichage informatif
  const exemplePatterns = [...GARBAGE_EXACT]
    .filter((p) => p.length <= 6 && /^[a-z\-\?\/\.0]+$/.test(p))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <Eraser className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nettoyage des données parasites</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Identifie et supprime les valeurs placeholder sans information métier (ZZZ, N/A, ---, etc.)
          </p>
        </div>
      </div>

      {/* Bandeau d'avertissement */}
      <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden />
        <p className="text-sm text-orange-900">
          <strong>Opération irréversible.</strong> Le nettoyage remplace définitivement les valeurs
          parasites par <em>null</em> (champ vide). Effectuez toujours un scan préalable et vérifiez
          l'aperçu avant de confirmer. L'opération est journalisée dans les logs d'audit.
        </p>
      </div>

      {/* Périmètre couvert */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="size-4 text-slate-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-700">Périmètre du scan</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-slate-600">
          <div>
            <p className="font-medium text-slate-800 mb-1">Table bénéficiaires</p>
            <p className="text-slate-500 leading-relaxed">
              prenom, nom, fonction_actuelle, intitule_formation, localite_residence,
              partenaire_accompagnement, telephone, courriel, tranche_age_declaree, commentaire
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">Table structures</p>
            <p className="text-slate-500 leading-relaxed">
              porteur_nom, porteur_prenom, nom_structure, fonction_porteur, adresse, localite,
              ville, secteur_precis, intitule_initiative, telephone_porteur, courriel_porteur, commentaire
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-700 mb-1.5">Exemples de patterns détectés :</p>
          <div className="flex flex-wrap gap-1">
            {exemplePatterns.map((p) => (
              <code key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                {p === '' ? '(vide)' : p}
              </code>
            ))}
            <span className="text-[11px] text-slate-400 self-center">+ mots-clés (zzzz, inconnu, test, n/a, nd…)</span>
          </div>
        </div>
      </div>

      {/* Composant client interactif */}
      <NettoyageClient />
    </div>
  );
}
