'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, AlertTriangle, CheckCircle2, Loader2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  VAGUES_ENQUETE_VALUES,
  VAGUE_ENQUETE_LIBELLES,
} from '@/lib/schemas/enquetes/nomenclatures';
import { resumerStrate } from '@/lib/schemas/campagne';
import {
  compterStrate,
  creerCampagneBrouillon,
  lancerCampagne,
  listerStrate,
  listerStrateIds,
  type ListerStrateLigne,
} from '@/lib/campagnes/server-actions';
import { ListeCiblesRevue } from './liste-cibles-revue';

type Mode = 'toutes' | 'filtres' | 'manuelle';
type Questionnaire = 'A' | 'B';

export type WizardCampagneProps = {
  projets: Array<{ code: string; libelle: string }>;
  pays: Array<{ code: string; libelle: string }>;
};

type ApercuStrate = {
  total: number;
  avec_email: number;
  sans_email: number;
  sans_consentement: number;
} | null;

const TAILLE_PAGE = 50;

export function WizardCampagne({ projets, pays }: WizardCampagneProps) {
  const router = useRouter();
  const [pendingAction, startAction] = useTransition();
  const [pendingApercu, startApercu] = useTransition();
  const [pendingListe, startListe] = useTransition();
  const [pendingInit, startInit] = useTransition();

  // ─── Étape 1 : type de campagne ──────────────────────────────────────────
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>('A');
  const [typeVague, setTypeVague] = useState<string>('ponctuelle');
  const [nom, setNom] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // ─── Étape 2 : strate ────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('filtres');
  const [filtreProjets, setFiltreProjets] = useState<string[]>([]);
  const [filtrePays, setFiltrePays] = useState<string[]>([]);
  const [filtreAnnees, setFiltreAnnees] = useState<number[]>([]);
  const [filtreSexe, setFiltreSexe] = useState<string>('');
  const [consentementSeul, setConsentementSeul] = useState<boolean>(true);

  // Liste paginée des cibles (mode manuel + mode filtres avec révision)
  const [recherche, setRecherche] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [lignes, setLignes] = useState<ListerStrateLigne[]>([]);
  const [totalListe, setTotalListe] = useState<number>(0);

  // Sélection : UUID des cibles cochées (pour les modes manuel + filtres+revue)
  const [selection, setSelection] = useState<Set<string>>(new Set());

  // Pool « éligibles » : tous les UUID issus du filtre courant (mode filtres)
  // — sert à savoir si l'utilisateur a tout coché ou décoché certains.
  const [idsEligibles, setIdsEligibles] = useState<Set<string>>(new Set());

  // Aperçu compteurs (pour mode filtres)
  const [apercu, setApercu] = useState<ApercuStrate>(null);

  // ─── Étape 3 : paramètres envoi ──────────────────────────────────────────
  const [plafond, setPlafond] = useState<number>(50);
  const [emailOverride, setEmailOverride] = useState<string>('');

  // ─── Filtres en JSONB pour la SQL ─────────────────────────────────────────
  const filtresJsonb = useMemo(() => {
    if (mode === 'toutes' || mode === 'manuelle') return {};
    const obj: Record<string, unknown> = { consentement_acquis_seul: consentementSeul };
    if (filtreProjets.length > 0) obj.projets = filtreProjets;
    if (filtrePays.length > 0) obj.pays = filtrePays;
    if (filtreAnnees.length > 0) {
      obj[questionnaire === 'A' ? 'annees' : 'annees_appui'] = filtreAnnees;
    }
    if (questionnaire === 'A' && filtreSexe) obj.sexe = filtreSexe;
    return obj;
  }, [mode, filtreProjets, filtrePays, filtreAnnees, filtreSexe, consentementSeul, questionnaire]);

  // ─── Reset à chaque changement de questionnaire ou de mode ────────────────
  useEffect(() => {
    setSelection(new Set());
    setIdsEligibles(new Set());
    setLignes([]);
    setTotalListe(0);
    setRecherche('');
    setPage(0);
  }, [questionnaire, mode]);

  // ─── Compteurs aperçu (mode filtres uniquement, debounce 250ms) ──────────
  useEffect(() => {
    if (mode !== 'filtres') {
      setApercu(null);
      return;
    }
    const timer = setTimeout(() => {
      startApercu(async () => {
        const r = await compterStrate(questionnaire, filtresJsonb);
        if (r.status === 'succes') {
          setApercu({
            total: r.total,
            avec_email: r.avec_email,
            sans_email: r.sans_email,
            sans_consentement: r.sans_consentement,
          });
        } else {
          setApercu(null);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [questionnaire, mode, filtresJsonb]);

  // ─── Mode FILTRES : pré-cocher tous les UUID éligibles à chaque changement
  // de filtre. Utilise lister_strate_ids (RPC légère).
  useEffect(() => {
    if (mode !== 'filtres') return;
    const timer = setTimeout(() => {
      startInit(async () => {
        const r = await listerStrateIds(questionnaire, filtresJsonb);
        if (r.status === 'succes') {
          const ids = new Set(r.ids);
          setIdsEligibles(ids);
          // Pré-coche tout (l'utilisateur peut décocher individuellement)
          setSelection(ids);
          setPage(0);
        } else {
          setIdsEligibles(new Set());
          setSelection(new Set());
        }
      });
    }, 350); // debounce un peu plus long que l'aperçu
    return () => clearTimeout(timer);
  }, [mode, questionnaire, filtresJsonb]);

  // ─── Charge la liste paginée (mode manuel ET mode filtres) ────────────────
  useEffect(() => {
    if (mode === 'toutes') return;
    startListe(async () => {
      const r = await listerStrate(
        questionnaire,
        mode === 'filtres' ? filtresJsonb : {},
        recherche,
        TAILLE_PAGE,
        page * TAILLE_PAGE,
      );
      if (r.status === 'succes') {
        setLignes(r.lignes);
        setTotalListe(r.total);
      } else {
        // Surface l'erreur pour faciliter le debug terrain
        toast.error(`Chargement liste : ${r.message}`, { duration: 8000 });
        setLignes([]);
        setTotalListe(0);
      }
    });
  }, [mode, questionnaire, filtresJsonb, recherche, page]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const toggleSelection = (id: string) => {
    setSelection((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  };

  const toggleTouteLaPage = () => {
    setSelection((s) => {
      const ns = new Set(s);
      const idsPage = lignes.map((l) => l.id);
      const tousCoches = idsPage.length > 0 && idsPage.every((id) => ns.has(id));
      for (const id of idsPage) {
        if (tousCoches) ns.delete(id);
        else ns.add(id);
      }
      return ns;
    });
  };

  const onPageChange = (p: number) => {
    setPage(p);
  };

  const onRechercheChange = (q: string) => {
    setRecherche(q);
    setPage(0);
  };

  /**
   * Construction du payload selon le mode et la sélection effective.
   * Logique senior : si l'utilisateur a décoché des cibles en mode filtres,
   * on bascule vers `manuelle` avec `cibles_manuelles` = sélection cochée.
   * Sinon (toutes cochées), on garde `filtres` qui utilise les filtres SQL.
   */
  const construirePayload = () => {
    let modeEffectif: Mode = mode;
    let ciblesManuelles: string[] | undefined;

    if (mode === 'manuelle') {
      modeEffectif = 'manuelle';
      ciblesManuelles = Array.from(selection);
    } else if (mode === 'filtres') {
      // Si la sélection diffère du pool éligible (décoche manuelle),
      // on bascule vers mode manuelle.
      const decochesPresents = idsEligibles.size > 0 && selection.size < idsEligibles.size;
      if (decochesPresents) {
        modeEffectif = 'manuelle';
        ciblesManuelles = Array.from(selection);
      } else {
        modeEffectif = 'filtres';
        ciblesManuelles = undefined;
      }
    } else {
      modeEffectif = mode;
    }

    return {
      nom,
      description,
      questionnaire,
      type_vague: typeVague,
      mode_selection: modeEffectif,
      filtres: modeEffectif === 'filtres' ? filtresJsonb : {},
      cibles_manuelles: ciblesManuelles,
      plafond,
      email_test_override: emailOverride || undefined,
    };
  };

  const handleSauvegarder = () => {
    startAction(async () => {
      const r = await creerCampagneBrouillon(construirePayload());
      if (r.status === 'succes') {
        toast.success('Brouillon enregistré', {
          description: `Campagne « ${nom} » sauvegardée. Vous pourrez la lancer plus tard.`,
        });
        router.push('/enquetes');
        router.refresh();
      } else if (r.status === 'erreur_validation') {
        toast.error(`${r.issues.length} erreur(s) de validation`, {
          description: r.issues.map((i) => `${i.path}: ${i.message}`).join(' · '),
        });
      } else if ('message' in r) {
        toast.error(r.message);
      }
    });
  };

  const handleLancer = () => {
    startAction(async () => {
      const creation = await creerCampagneBrouillon(construirePayload());
      if (creation.status !== 'succes') {
        if (creation.status === 'erreur_validation') {
          toast.error(`${creation.issues.length} erreur(s) de validation`, {
            description: creation.issues.map((i) => `${i.path}: ${i.message}`).join(' · '),
          });
        } else if ('message' in creation) {
          toast.error(creation.message);
        }
        return;
      }
      const lancement = await lancerCampagne(creation.campagneId);
      if (lancement.status === 'succes') {
        toast.success(
          `${lancement.envoyes} email(s) envoyés sur ${lancement.total_cibles} cible(s)`,
          {
            description:
              lancement.sans_email.length > 0 || lancement.echecs.length > 0
                ? `${lancement.sans_email.length} sans email · ${lancement.echecs.length} échec(s)`
                : 'Tous les destinataires ont reçu l\u2019invitation.',
            duration: 12000,
          },
        );
        router.push('/enquetes');
        router.refresh();
      } else if (lancement.status === 'plafond_depasse') {
        toast.error(lancement.message, { duration: 10000 });
      } else if ('message' in lancement) {
        toast.error(lancement.message);
      }
    });
  };

  const enabled = nom.trim().length >= 3 && !pendingAction;
  const totalPages = Math.max(1, Math.ceil(totalListe / TAILLE_PAGE));

  // Total éligibles affiché en mode filtres = pool initial (avant décoche).
  // En mode manuel = totalListe (résultats de la recherche/pagination).
  const totalEligiblesAffiche = mode === 'filtres' ? idsEligibles.size : totalListe;

  return (
    <div className="space-y-6">
      {/* ╭────────────────────────── ÉTAPE 1 ──────────────────────────╮ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Type de campagne</CardTitle>
          <CardDescription>
            Identifiez la campagne pour la retrouver dans l&apos;historique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="questionnaire">Questionnaire *</Label>
              <Select
                value={questionnaire}
                onValueChange={(v) => setQuestionnaire((v as Questionnaire) ?? 'A')}
              >
                <SelectTrigger id="questionnaire">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A : Bénéficiaires (jeunes formés)</SelectItem>
                  <SelectItem value="B">B : Structures (activités économiques)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="type_vague">Type de vague *</Label>
              <Select value={typeVague} onValueChange={(v) => setTypeVague(v ?? 'ponctuelle')}>
                <SelectTrigger id="type_vague">
                  <SelectValue>
                    {(v: string | null) =>
                      v
                        ? (VAGUE_ENQUETE_LIBELLES[v as keyof typeof VAGUE_ENQUETE_LIBELLES] ?? v)
                        : ''
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VAGUES_ENQUETE_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {VAGUE_ENQUETE_LIBELLES[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nom">Nom de la campagne *</Label>
            <Input
              id="nom"
              maxLength={200}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Évaluation post-formation Mali 2024 - Cohorte D-CLIC"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description (contexte, objectifs)</Label>
            <Textarea
              id="description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel : précisez la finalité de cette collecte."
            />
          </div>
        </CardContent>
      </Card>

      {/* ╭────────────────────────── ÉTAPE 2 ──────────────────────────╮ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Définition de la strate</CardTitle>
          <CardDescription>
            Méthodologie OIF : on cible une strate précise (ne JAMAIS lancer à toute la base).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode de sélection */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Mode de sélection</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { v: 'toutes', l: 'Toutes les cibles éligibles' },
                  { v: 'filtres', l: 'Sélection par filtres (strate)' },
                  { v: 'manuelle', l: 'Sélection manuelle (cocher cibles)' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.v}
                  className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={opt.v}
                    checked={mode === opt.v}
                    onChange={() => setMode(opt.v)}
                    className="mt-0.5"
                  />
                  {opt.l}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Filtres */}
          {mode === 'filtres' && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-muted-foreground text-xs">
                Chaque filtre actualise les compteurs en temps réel. Laisser vide = pas de filtre
                sur ce critère.
              </p>
              <FiltreCheckboxes
                label="Projets"
                options={projets.map((p) => ({ value: p.code, label: `${p.code} : ${p.libelle}` }))}
                selection={filtreProjets}
                onChange={setFiltreProjets}
              />
              <FiltreCheckboxes
                label="Pays"
                options={pays.map((p) => ({ value: p.code, label: `${p.code} : ${p.libelle}` }))}
                selection={filtrePays}
                onChange={setFiltrePays}
                hauteur="max-h-40"
              />
              <FiltreCheckboxes
                label={questionnaire === 'A' ? 'Année de formation' : "Année d'appui"}
                options={[2023, 2024, 2025].map((a) => ({
                  value: String(a),
                  label: String(a),
                }))}
                selection={filtreAnnees.map(String)}
                onChange={(vals) => setFiltreAnnees(vals.map((v) => Number(v)))}
              />
              {questionnaire === 'A' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Sexe</Label>
                    <Select
                      value={filtreSexe || 'tous'}
                      onValueChange={(v) => setFiltreSexe(v === 'tous' ? '' : (v ?? ''))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tous">Tous</SelectItem>
                        <SelectItem value="F">Femmes</SelectItem>
                        <SelectItem value="M">Hommes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={consentementSeul}
                      onChange={(e) => setConsentementSeul(e.target.checked)}
                    />
                    Consentement RGPD acquis uniquement
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Aperçu strate (uniquement mode filtres) */}
          {mode === 'filtres' && (
            <ApercuStrateCard
              apercu={apercu}
              pending={pendingApercu}
              resume={resumerStrate(questionnaire, filtresJsonb)}
              mode={mode}
              selectionSize={selection.size}
              plafond={plafond}
            />
          )}

          {/* Liste de révision (mode filtres avec décoche manuelle) */}
          {mode === 'filtres' && (apercu?.total ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ListChecks aria-hidden className="size-4 text-amber-600" />
                Réviser la liste
                {pendingInit && (
                  <Loader2 className="text-muted-foreground inline size-3 animate-spin" />
                )}
              </div>
              <ListeCiblesRevue
                lignes={lignes}
                selection={selection}
                onToggleCible={toggleSelection}
                onToggleTouteLaPage={toggleTouteLaPage}
                recherche={recherche}
                onRechercheChange={onRechercheChange}
                page={page}
                totalPages={totalPages}
                totalEligibles={totalEligiblesAffiche}
                onPageChange={onPageChange}
                pending={pendingListe}
                mode="filtres"
              />
            </div>
          )}

          {/* Sélection manuelle (mode = 'manuelle') */}
          {mode === 'manuelle' && (
            <ListeCiblesRevue
              lignes={lignes}
              selection={selection}
              onToggleCible={toggleSelection}
              onToggleTouteLaPage={toggleTouteLaPage}
              recherche={recherche}
              onRechercheChange={onRechercheChange}
              page={page}
              totalPages={totalPages}
              totalEligibles={totalEligiblesAffiche}
              onPageChange={onPageChange}
              pending={pendingListe}
              mode="manuelle"
            />
          )}

          {/* Résumé pour mode toutes */}
          {mode === 'toutes' && (
            <ApercuStrateCard
              apercu={apercu}
              pending={pendingApercu}
              resume={resumerStrate(questionnaire, {})}
              mode={mode}
              selectionSize={0}
              plafond={plafond}
            />
          )}
        </CardContent>
      </Card>

      {/* ╭────────────────────────── ÉTAPE 3 ──────────────────────────╮ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Paramètres d&apos;envoi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="plafond">Plafond cibles *</Label>
              <Input
                id="plafond"
                type="number"
                min={1}
                max={200}
                value={plafond}
                onChange={(e) =>
                  setPlafond(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                }
              />
              <p className="text-muted-foreground text-xs">
                Max 200 par lancement (Resend Free : 100/jour). Au-delà, créez plusieurs campagnes
                étalées.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email_override">Email test (override)</Label>
              <Input
                id="email_override"
                type="email"
                value={emailOverride}
                onChange={(e) => setEmailOverride(e.target.value)}
                placeholder="Ex. votre-email@oif.org"
              />
              <p className="text-muted-foreground text-xs">
                Si renseigné, tous les emails sont envoyés à cette adresse (validation pré-prod).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSauvegarder}
          disabled={!enabled}
          className="gap-2"
        >
          <Save aria-hidden className="size-4" />
          {pendingAction ? 'Enregistrement…' : 'Sauvegarder en brouillon'}
        </Button>
        <Button type="button" onClick={handleLancer} disabled={!enabled} className="gap-2">
          <Send aria-hidden className="size-4" />
          {pendingAction ? 'Lancement…' : 'Lancer la campagne'}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function FiltreCheckboxes({
  label,
  options,
  selection,
  onChange,
  hauteur = 'max-h-32',
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selection: string[];
  onChange: (vals: string[]) => void;
  hauteur?: string;
}) {
  const toggle = (v: string) => {
    if (selection.includes(v)) onChange(selection.filter((s) => s !== v));
    else onChange([...selection, v]);
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div
        className={`grid grid-cols-1 gap-1 overflow-y-auto rounded border p-2 sm:grid-cols-2 ${hauteur}`}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded p-1 text-xs"
          >
            <input
              type="checkbox"
              checked={selection.includes(o.value)}
              onChange={() => toggle(o.value)}
              className="mt-0.5"
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {selection.length === 0 ? 'Aucun filtre' : `${selection.length} sélectionné(s)`}
      </p>
    </div>
  );
}

function ApercuStrateCard({
  apercu,
  pending,
  resume,
  mode,
  selectionSize,
  plafond,
}: {
  apercu: ApercuStrate;
  pending: boolean;
  resume: string;
  mode: Mode;
  selectionSize: number;
  plafond: number;
}) {
  const total = mode === 'manuelle' ? selectionSize : (apercu?.total ?? 0);
  const eligibles = mode === 'manuelle' ? selectionSize : (apercu?.avec_email ?? 0);
  const viable = eligibles > 0 && eligibles <= plafond;

  return (
    <Card className="border-primary/30 bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Aperçu de la strate
          {pending && <Loader2 className="ml-2 inline size-3 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Cibles dans le périmètre</span>
          <Badge variant="outline" className="tabular-nums">
            {total}
          </Badge>
        </div>
        {mode !== 'manuelle' && apercu && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-700 dark:text-green-400">
                Avec email + consentement RGPD
              </span>
              <Badge className="tabular-nums">{apercu.avec_email}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-700 dark:text-amber-400">Sans email valide</span>
              <Badge variant="secondary" className="tabular-nums">
                {apercu.sans_email}
              </Badge>
            </div>
          </>
        )}
        {mode === 'filtres' && (
          <p className="text-muted-foreground border-t pt-2 text-xs italic">Résumé : {resume}</p>
        )}
        <div
          className={`mt-2 flex items-center gap-2 rounded p-2 text-xs ${
            viable
              ? 'bg-green-100 text-green-900 dark:bg-green-950/30 dark:text-green-100'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
          }`}
        >
          {viable ? (
            <>
              <CheckCircle2 aria-hidden className="size-4 shrink-0" />
              <span>
                Strate viable : <strong>{eligibles}</strong> destinataires éligibles dans le
                plafond.
              </span>
            </>
          ) : eligibles === 0 ? (
            <>
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <span>Aucun destinataire éligible. Ajustez les filtres ou la sélection.</span>
            </>
          ) : (
            <>
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <span>
                {eligibles} éligibles dépassent le plafond de {plafond}. Affinez ou augmentez le
                plafond.
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
