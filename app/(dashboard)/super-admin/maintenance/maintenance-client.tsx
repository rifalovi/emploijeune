'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { EffectifsActuels } from './page';
import {
  purgerDonneesMetier,
  recalculerIndicateurs,
} from '@/lib/super-admin/server-actions';

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  effectifs: EffectifsActuels;
};

// ── Composant principal ──────────────────────────────────────────────────────

export function MaintenanceClient({ effectifs }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CartePurge effectifs={effectifs} pending={pending} startTransition={startTransition} />
      <CarteRecalcul pending={pending} startTransition={startTransition} />
    </div>
  );
}

// ── Carte Purge ──────────────────────────────────────────────────────────────

const TABLES_PURGEES = [
  'beneficiaires',
  'structures',
  'valeurs_indicateurs_saisies',
  'alertes_qualite',
  'import_sessions',
  'reponses_enquetes',
  'tokens_enquete_publique',
  'structure_projet_historique',
];

const MOT_CLE = 'VIDER LA BASE';

function CartePurge({
  effectifs,
  pending,
  startTransition,
}: {
  effectifs: EffectifsActuels;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [etape, setEtape] = useState(0); // 0=fermé, 1=lecture, 2=checkbox, 3=mot-clé
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [motCle, setMotCle] = useState('');

  const reinitialiser = () => {
    setEtape(0);
    setCheckConfirm(false);
    setMotCle('');
  };

  const executerPurge = () => {
    startTransition(async () => {
      const res = await purgerDonneesMetier();
      if (res.status === 'succes') {
        toast.success('Base vidée. Réimportez vos données puis lancez le recalcul.', {
          duration: 10000,
        });
        reinitialiser();
      } else {
        toast.error(`Erreur : ${res.message}`, { duration: 8000 });
      }
    });
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="size-5" />
          Vider la base de données
        </CardTitle>
        <CardDescription>
          Supprime toutes les données métier (bénéficiaires, structures,
          indicateurs, alertes, imports, réponses). Les comptes utilisateurs,
          le référentiel pays, les projets et la configuration sont préservés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Effectifs actuels */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Effectifs actuels
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Effectif label="Bénéficiaires" valeur={effectifs.beneficiaires} />
            <Effectif label="Structures" valeur={effectifs.structures} />
            <Effectif label="Indicateurs saisis" valeur={effectifs.indicateurs_saisis} />
            <Effectif label="Alertes qualité" valeur={effectifs.alertes_qualite} />
            <Effectif label="Sessions d'import" valeur={effectifs.import_sessions} />
            <Effectif label="Réponses enquêtes" valeur={effectifs.reponses_enquetes} />
          </div>
        </div>

        {/* Tables purgées */}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium hover:text-slate-700">
            Tables concernées ({TABLES_PURGEES.length})
          </summary>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {TABLES_PURGEES.map((t) => (
              <li key={t}><code>{t}</code></li>
            ))}
          </ul>
        </details>

        {/* Bouton d'ouverture du modal */}
        {etape === 0 && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setEtape(1)}
            disabled={pending}
          >
            <Trash2 className="mr-2 size-4" />
            Vider la base...
          </Button>
        )}

        {/* Étape 1 — Lecture */}
        {etape === 1 && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Cette action est irréversible.</p>
                <p className="mt-1">
                  Toutes les données métier seront définitivement supprimées.
                  Aucun backup automatique n&apos;est créé. Assurez-vous d&apos;avoir
                  un export ou un backup Supabase avant de continuer.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reinitialiser}>
                Annuler
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setEtape(2)}>
                J&apos;ai compris, continuer
              </Button>
            </div>
          </div>
        )}

        {/* Étape 2 — Checkbox */}
        {etape === 2 && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <label className="flex items-start gap-2 text-sm text-red-800">
              <input
                type="checkbox"
                checked={checkConfirm}
                onChange={(e) => setCheckConfirm(e.target.checked)}
                className="mt-1 size-4 rounded border-red-300"
              />
              <span>
                Je confirme avoir lu et compris que cette action est irréversible.
                Aucun backup automatique n&apos;est créé.
              </span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reinitialiser}>
                Annuler
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setEtape(3)}
                disabled={!checkConfirm}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}

        {/* Étape 3 — Mot-clé */}
        {etape === 3 && (
          <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Tapez <code className="rounded bg-red-100 px-1.5 py-0.5 font-bold">{MOT_CLE}</code> pour confirmer :
            </p>
            <input
              type="text"
              value={motCle}
              onChange={(e) => setMotCle(e.target.value)}
              placeholder={MOT_CLE}
              className="w-full rounded border border-red-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reinitialiser}>
                Annuler
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={executerPurge}
                disabled={motCle !== MOT_CLE || pending}
              >
                {pending ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Vider la base
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Carte Recalcul ───────────────────────────────────────────────────────────

function CarteRecalcul({
  pending,
  startTransition,
}: {
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const handleRecalcul = () => {
    startTransition(async () => {
      const res = await recalculerIndicateurs();
      if (res.status === 'succes') {
        const r = res.data.resultats;
        toast.success(
          `Recalcul terminé : ${r.beneficiaires} bénéficiaires, ${r.structures} structures, ${r.alertes_generees} alertes générées.`,
          { duration: 8000 },
        );
      } else {
        toast.error(`Erreur : ${res.message}`, { duration: 8000 });
      }
    });
  };

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <RefreshCw className="size-5" />
          Forcer la mise à jour des indicateurs
        </CardTitle>
        <CardDescription>
          Recalcule toutes les agrégations (vitrine, dashboard, analyses)
          et régénère les alertes qualité automatiques (pays ZZZ, pays NULL,
          tranche d&apos;âge manquante). À lancer après chaque réimport de données.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full bg-amber-600 hover:bg-amber-700"
          onClick={handleRecalcul}
          disabled={pending}
        >
          {pending ? (
            <RefreshCw className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Forcer la mise à jour
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Effectif({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{valeur.toLocaleString('fr-FR')}</span>
    </div>
  );
}
