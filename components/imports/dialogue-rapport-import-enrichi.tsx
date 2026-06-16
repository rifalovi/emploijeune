'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  SkipForward,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { annulerImportSession } from '@/lib/imports/import-beneficiaires';
import type {
  ComparaisonDoublon,
  LigneRapportImport,
  RapportImportEnrichi,
  StatutLigneImport,
} from '@/lib/imports/types';

export type DialogueRapportImportEnrichiProps = {
  rapport: RapportImportEnrichi | null;
  onClose: () => void;
  /**
   * Si fourni et `nb > 0`, affiche un bouton « Importer quand même N doublon(s) »
   * dans le pied du rapport (insertion forcée pour traitement manuel ultérieur).
   */
  forcerDoublons?: { nb: number; pending: boolean; onForcer: () => void };
};

/**
 * Rapport d'import enrichi avec 5 sections par statut :
 *   ✅ INSÉRÉES (vert)            : nouvelles fiches
 *   🔄 ENRICHIES (bleu)           : doublons mis à jour
 *   ⏭ DOUBLONS IGNORÉS (gris)    : déjà identiques
 *   ⚠️ INCOMPLÈTES (orange)       : insérées mais champs manquants
 *   ❌ REJETÉES (rouge)             : erreur bloquante
 *
 * Chaque section est dépliable, montre les lignes du fichier concernées
 * + mappages automatiques appliqués + champs manquants / erreurs.
 */
export function DialogueRapportImportEnrichi({
  rapport,
  onClose,
  forcerDoublons,
}: DialogueRapportImportEnrichiProps) {
  const [rollbackEnCours, setRollbackEnCours] = useState(false);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);
  const [rollbackFait, setRollbackFait] = useState(false);
  const [copie, setCopie] = useState(false);

  const handleCopier = () => {
    if (!rapport) return;
    const lignes: string[] = [
      `Rapport d'import — ${rapport.fichier_nom}`,
      `${rapport.nb_lignes_total} ligne${rapport.nb_lignes_total > 1 ? 's' : ''} traitée${rapport.nb_lignes_total > 1 ? 's' : ''}`,
      ``,
      `Insérées      : ${rapport.nb_inserees}`,
      `Enrichies     : ${rapport.nb_enrichies}`,
      `Doublons ign. : ${rapport.nb_doublons_identiques}`,
      `Incomplètes   : ${rapport.nb_incompletes}`,
      `Rejetées      : ${rapport.nb_rejetees}`,
    ];
    if (rapport.import_session_id) {
      lignes.push(``, `Session : ${rapport.import_session_id}`);
    }
    if (rapport.rollback_expire_at) {
      lignes.push(
        `Rollback disponible jusqu'au ${new Date(rapport.rollback_expire_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      );
    }
    if (Object.keys(rapport.headers_mappes_auto).length > 0) {
      lignes.push(``, `Mappages automatiques :`);
      for (const [lu, cible] of Object.entries(rapport.headers_mappes_auto)) {
        lignes.push(`  « ${lu} » → « ${cible} »`);
      }
    }
    if (rapport.headers_non_reconnus.length > 0) {
      lignes.push(``, `Colonnes non reconnues : ${rapport.headers_non_reconnus.join(', ')}`);
    }
    // Lignes rejetées
    const rejetees = rapport.lignes.filter((l) => l.statut === 'rejetee');
    if (rejetees.length > 0) {
      lignes.push(``, `Lignes rejetées (${rejetees.length}) :`);
      for (const l of rejetees) {
        const errMsg = l.erreurs
          .map((e) => (e.colonne ? `${e.colonne}: ${e.message}` : e.message))
          .join(' | ');
        lignes.push(`  L${l.numero_ligne} — ${errMsg || 'erreur inconnue'}`);
      }
    }
    // Lignes incomplètes
    const incompletes = rapport.lignes.filter((l) => l.statut === 'incomplete');
    if (incompletes.length > 0) {
      lignes.push(``, `Lignes incomplètes (${incompletes.length}) :`);
      for (const l of incompletes) {
        lignes.push(`  L${l.numero_ligne} — Manquant : ${l.champs_manquants.join(', ')}`);
      }
    }
    navigator.clipboard.writeText(lignes.join('\n')).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    });
  };

  if (!rapport) return null;

  const peutRollback =
    !rollbackFait &&
    !!rapport.import_session_id &&
    !!rapport.rollback_expire_at &&
    new Date(rapport.rollback_expire_at) > new Date();

  const handleRollback = async () => {
    if (!rapport.import_session_id) return;
    setRollbackEnCours(true);
    setRollbackMessage(null);
    try {
      const result = await annulerImportSession(rapport.import_session_id);
      if (result.status === 'succes') {
        setRollbackFait(true);
        setRollbackMessage(
          `Import annulé avec succès — ${result.nb_annules} bénéficiaire${result.nb_annules > 1 ? 's' : ''} supprimé${result.nb_annules > 1 ? 's' : ''}.`,
        );
      } else {
        setRollbackMessage(result.message);
      }
    } catch {
      setRollbackMessage('Erreur inattendue lors du rollback. Réessayez ou contactez le support.');
    } finally {
      setRollbackEnCours(false);
    }
  };

  return (
    <Dialog open={!!rapport} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#0E4F88]" aria-hidden />
            Rapport d&apos;import — {rapport.fichier_nom}
          </DialogTitle>
          <DialogDescription>
            {rapport.nb_lignes_total} ligne{rapport.nb_lignes_total > 1 ? 's' : ''} traitée
            {rapport.nb_lignes_total > 1 ? 's' : ''}. Détail par statut ci-dessous.
          </DialogDescription>
        </DialogHeader>

        {/* Bloc rollback */}
        {rapport.import_session_id && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs ${rollbackFait ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">Session d&apos;import :</span>{' '}
                <code className="font-mono text-[10px]">{rapport.import_session_id}</code>
                {rapport.rollback_expire_at && !rollbackFait && (
                  <span className="ml-2 text-amber-600">
                    Rollback disponible jusqu&apos;au{' '}
                    {new Date(rapport.rollback_expire_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                )}
                {rollbackMessage && (
                  <p
                    className={`mt-1 font-medium ${rollbackFait ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    {rollbackMessage}
                  </p>
                )}
              </div>
              {peutRollback && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={rollbackEnCours}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                        {rollbackEnCours ? 'Annulation…' : 'Annuler cet import'}
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Confirmer l&apos;annulation de l&apos;import
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action va supprimer (soft-delete) les{' '}
                        <strong>
                          {rapport.nb_inserees + rapport.nb_incompletes} bénéficiaire
                          {rapport.nb_inserees + rapport.nb_incompletes > 1 ? 's' : ''}
                        </strong>{' '}
                        insérés lors de cet import. Les doublons enrichis ne sont pas affectés.
                        <br />
                        <br />
                        Cette action est <strong>irréversible</strong> (les bénéficiaires seront
                        archivés mais non effacés définitivement).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleRollback}
                      >
                        Confirmer l&apos;annulation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}

        {/* Compteurs principaux */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Compteur
            n={rapport.nb_inserees}
            label="Insérées"
            classe="bg-emerald-50 text-emerald-700 border-emerald-200"
          />
          <Compteur
            n={rapport.nb_enrichies}
            label="Enrichies"
            classe="bg-blue-50 text-blue-700 border-blue-200"
          />
          <Compteur
            n={rapport.nb_doublons_identiques}
            label="Doublons ignorés"
            classe="bg-slate-50 text-slate-600 border-slate-200"
          />
          <Compteur
            n={rapport.nb_incompletes}
            label="Incomplètes"
            classe="bg-amber-50 text-amber-700 border-amber-200"
          />
          <Compteur
            n={rapport.nb_rejetees}
            label="Rejetées"
            classe="bg-red-50 text-red-700 border-red-200"
          />
        </div>

        {/* Mappages d'en-têtes auto-détectés */}
        {Object.keys(rapport.headers_mappes_auto).length > 0 && (
          <details className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            <summary className="cursor-pointer font-semibold">
              Mappages automatiques d&apos;en-têtes détectés (
              {Object.keys(rapport.headers_mappes_auto).length})
            </summary>
            <ul className="mt-2 space-y-1">
              {Object.entries(rapport.headers_mappes_auto).map(([lu, cible]) => (
                <li key={lu} className="font-mono">
                  « {lu} » → « {cible} »
                </li>
              ))}
            </ul>
          </details>
        )}

        {rapport.headers_non_reconnus.length > 0 && (
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold">
              Colonnes ignorées (non reconnues) — {rapport.headers_non_reconnus.length}
            </summary>
            <p className="mt-2 text-slate-600">
              Ces colonnes du fichier n&apos;ont pas pu être identifiées et ne sont pas importées :
            </p>
            <ul className="mt-1 list-disc pl-5 font-mono">
              {rapport.headers_non_reconnus.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </details>
        )}

        {/* 5 sections par statut */}
        <SectionStatut
          lignes={rapport.lignes}
          statut="inseree"
          titre="Insérées"
          icone={<CheckCircle2 className="size-4" aria-hidden />}
          couleur="emerald"
          intro="Nouvelles fiches ajoutées à la base."
        />
        <SectionStatut
          lignes={rapport.lignes}
          statut="enrichie"
          titre="Enrichies"
          icone={<RefreshCw className="size-4" aria-hidden />}
          couleur="blue"
          intro="Doublons existants mis à jour avec de nouvelles données."
        />
        <SectionStatut
          lignes={rapport.lignes}
          statut="incomplete"
          titre="Incomplètes"
          icone={<AlertTriangle className="size-4" aria-hidden />}
          couleur="amber"
          intro="Insérées mais avec des données manquantes — à compléter via une campagne de collecte."
        />
        <SectionStatut
          lignes={rapport.lignes}
          statut="doublon_identique"
          titre="Doublons ignorés"
          icone={<SkipForward className="size-4" aria-hidden />}
          couleur="slate"
          intro="Fiches identiques déjà présentes — aucune action."
        />
        <SectionStatut
          lignes={rapport.lignes}
          statut="rejetee"
          titre="Rejetées"
          icone={<XCircle className="size-4" aria-hidden />}
          couleur="red"
          intro="Lignes non importées (champ vraiment bloquant absent ou invalide)."
        />

        <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopier}
            className="gap-1.5"
            title="Copier le résumé dans le presse-papiers"
          >
            {copie ? (
              <Check className="size-4 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copie ? 'Copié !' : 'Copier le résumé'}
          </Button>
          {forcerDoublons && forcerDoublons.nb > 0 && (
            <Button
              variant="outline"
              onClick={forcerDoublons.onForcer}
              disabled={forcerDoublons.pending}
              className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50"
              title="Insère les doublons identifiés (même courriel ou téléphone) pour traitement manuel ultérieur"
            >
              <RotateCcw className="size-4" aria-hidden />
              {forcerDoublons.pending
                ? 'Import en cours…'
                : `Importer quand même ${forcerDoublons.nb} doublon${forcerDoublons.nb > 1 ? 's' : ''}`}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tableau de correspondance champ par champ d'un doublon : montre, pour la
 * fiche importée (L{numéro}) vs la fiche existante, chaque champ comparé, s'il
 * correspond (✓ vert / ✗ rouge) et le pourcentage global de correspondance.
 * Répond à la demande : « voir clairement toutes les correspondances champ par
 * champ quand on identifie le doublon ».
 */
function ComparaisonDoublonTable({
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

function Compteur({ n, label, classe }: { n: number; label: string; classe: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${classe}`}>
      <div className="text-lg font-bold tabular-nums">{n}</div>
      <div className="text-[10px] tracking-wide uppercase">{label}</div>
    </div>
  );
}

const COULEUR_CLASSES: Record<
  'emerald' | 'blue' | 'amber' | 'slate' | 'red',
  { bg: string; text: string; border: string }
> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function SectionStatut({
  lignes,
  statut,
  titre,
  icone,
  couleur,
  intro,
}: {
  lignes: LigneRapportImport[];
  statut: StatutLigneImport;
  titre: string;
  icone: React.ReactNode;
  couleur: keyof typeof COULEUR_CLASSES;
  intro: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const filtrees = lignes.filter((l) => l.statut === statut);
  if (filtrees.length === 0) return null;

  const cls = COULEUR_CLASSES[couleur];

  return (
    <section className={`rounded-lg border ${cls.border} ${cls.bg}`}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left font-medium ${cls.text}`}
      >
        <span className="flex items-center gap-2">
          {icone}
          {titre} ({filtrees.length})
        </span>
        {ouvert ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
      </button>
      {ouvert && (
        <div className="border-t border-current/10 px-4 py-3 text-xs text-slate-700">
          <p className="mb-3 text-slate-600 italic">{intro}</p>
          <ul className="space-y-2">
            {filtrees.map((l) => (
              <li key={l.numero_ligne} className="rounded bg-white p-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-slate-500">L{l.numero_ligne}</span>
                  {l.extrait_par_ia && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                      <Sparkles className="size-2.5" aria-hidden />
                      Extrait par IA
                      {typeof l.confiance_ia === 'number' ? ` (${l.confiance_ia}%)` : ''}
                    </span>
                  )}
                  {l.donnees_importees?.projet && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                      {l.donnees_importees.projet}
                    </span>
                  )}
                  {l.donnees_importees?.pays && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                      {l.donnees_importees.pays}
                    </span>
                  )}
                  {l.donnees_importees?.annee && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                      {l.donnees_importees.annee}
                    </span>
                  )}
                  {l.donnees_importees?.courriel && (
                    <span className="truncate font-mono text-[10px] text-slate-500">
                      {l.donnees_importees.courriel}
                    </span>
                  )}
                </div>
                {l.mappages_auto.length > 0 && (
                  <p className="mt-1 text-[10px] text-blue-600">
                    Auto-mappé : {l.mappages_auto.join(' · ')}
                  </p>
                )}
                {l.champs_mis_a_jour.length > 0 && (
                  <p className="mt-1 text-[10px] text-blue-600">
                    Champs comblés : {l.champs_mis_a_jour.join(', ')}
                  </p>
                )}
                {l.champs_manquants.length > 0 && (
                  <p className="mt-1 text-[10px] text-amber-700">
                    Manquant : {l.champs_manquants.join(', ')}
                  </p>
                )}
                {l.alertes.length > 0 && (
                  <p className="mt-1 text-[10px] text-slate-500 italic">{l.alertes.join(' / ')}</p>
                )}
                {l.comparaison_doublon && (
                  <ComparaisonDoublonTable
                    comparaison={l.comparaison_doublon}
                    numeroLigne={l.numero_ligne}
                  />
                )}
                {l.erreurs.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-[10px] text-red-700">
                    {l.erreurs.map((e, i) => (
                      <li key={i}>
                        {e.colonne ? <span className="font-semibold">{e.colonne}</span> : null}
                        {e.colonne ? ' : ' : ''}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
