'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, AlertTriangle, CheckCircle2, Search, Loader2 } from 'lucide-react';
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
  type ListerStrateLigne,
} from '@/lib/campagnes/server-actions';

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

export function WizardCampagne({ projets, pays }: WizardCampagneProps) {
  const router = useRouter();
  const [pendingAction, startAction] = useTransition();
  const [pendingApercu, startApercu] = useTransition();
  const [pendingListe, startListe] = useTransition();

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

  // Mode manuel
  const [recherche, setRecherche] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [lignes, setLignes] = useState<ListerStrateLigne[]>([]);
  const [totalManuel, setTotalManuel] = useState<number>(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const TAILLE_PAGE = 50;

  // Aperçu compteurs
  const [apercu, setApercu] = useState<ApercuStrate>(null);

  // ─── Étape 3 : paramètres envoi ──────────────────────────────────────────
  const [plafond, setPlafond] = useState<number>(50);
  const [emailOverride, setEmailOverride] = useState<string>('');

  // ─── Filtres en JSONB pour la SQL ─────────────────────────────────────────
  const filtresJsonb = useMemo(() => {
    if (mode === 'toutes') return {};
    if (mode === 'manuelle') return {};
    const obj: Record<string, unknown> = {
      consentement_acquis_seul: consentementSeul,
    };
    if (filtreProjets.length > 0) obj.projets = filtreProjets;
    if (filtrePays.length > 0) obj.pays = filtrePays;
    if (filtreAnnees.length > 0) {
      obj[questionnaire === 'A' ? 'annees' : 'annees_appui'] = filtreAnnees;
    }
    if (questionnaire === 'A' && filtreSexe) obj.sexe = filtreSexe;
    return obj;
  }, [mode, filtreProjets, filtrePays, filtreAnnees, filtreSexe, consentementSeul, questionnaire]);

  // ─── Recharge apercu à chaque changement de strate (debounce 250ms) ──────
  useEffect(() => {
    if (mode === 'manuelle') {
      setApercu({
        total: lignes.length === 0 ? 0 : totalManuel,
        avec_email: selection.size,
        sans_email: 0,
        sans_consentement: 0,
      });
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
  }, [questionnaire, mode, filtresJsonb, lignes.length, totalManuel, selection.size]);

  // ─── Mode manuel : charge la page courante ───────────────────────────────
  useEffect(() => {
    if (mode !== 'manuelle') return;
    startListe(async () => {
      const r = await listerStrate(questionnaire, {}, recherche, TAILLE_PAGE, page * TAILLE_PAGE);
      if (r.status === 'succes') {
        setLignes(r.lignes);
        setTotalManuel(r.total);
      }
    });
  }, [mode, questionnaire, recherche, page]);

  // Reset sélection si changement de questionnaire ou de mode
  useEffect(() => {
    setSelection(new Set());
    setPage(0);
  }, [questionnaire, mode]);

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
      const tousCoches = idsPage.every((id) => ns.has(id));
      for (const id of idsPage) {
        if (tousCoches) ns.delete(id);
        else ns.add(id);
      }
      return ns;
    });
  };

  const construirePayload = (statutCible: 'brouillon' | 'lancer') => ({
    nom,
    description,
    questionnaire,
    type_vague: typeVague,
    mode_selection: mode,
    filtres: mode === 'filtres' ? filtresJsonb : {},
    cibles_manuelles: mode === 'manuelle' ? Array.from(selection) : undefined,
    plafond,
    email_test_override: emailOverride || undefined,
    _action: statutCible,
  });

  const handleSauvegarder = () => {
    startAction(async () => {
      const r = await creerCampagneBrouillon(construirePayload('brouillon'));
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
      const creation = await creerCampagneBrouillon(construirePayload('lancer'));
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
  const totalPages = Math.max(1, Math.ceil(totalManuel / TAILLE_PAGE));

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
                  <SelectItem value="A">A — Bénéficiaires (jeunes formés)</SelectItem>
                  <SelectItem value="B">B — Structures (activités économiques)</SelectItem>
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
                options={projets.map((p) => ({ value: p.code, label: `${p.code} — ${p.libelle}` }))}
                selection={filtreProjets}
                onChange={setFiltreProjets}
              />
              <FiltreCheckboxes
                label="Pays"
                options={pays.map((p) => ({ value: p.code, label: `${p.code} — ${p.libelle}` }))}
                selection={filtrePays}
                onChange={setFiltrePays}
                hauteur="max-h-40"
              />
              <FiltreCheckboxes
                label={questionnaire === 'A' ? 'Année de formation' : 'Année d\u2019appui'}
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

          {/* Sélection manuelle */}
          {mode === 'manuelle' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    aria-hidden
                    className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                  />
                  <Input
                    value={recherche}
                    onChange={(e) => {
                      setRecherche(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Rechercher un nom ou un email…"
                    className="pl-8"
                  />
                </div>
                <span className="text-sm font-medium">
                  {selection.size} sélectionné(s) sur {totalManuel} éligibles
                </span>
              </div>

              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="w-10 p-2">
                        <input
                          type="checkbox"
                          aria-label="Tout sélectionner cette page"
                          checked={lignes.length > 0 && lignes.every((l) => selection.has(l.id))}
                          onChange={toggleTouteLaPage}
                        />
                      </th>
                      <th className="p-2 text-left">Cible</th>
                      <th className="p-2 text-left">Projet</th>
                      <th className="p-2 text-left">Pays</th>
                      <th className="p-2 text-left">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingListe ? (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground p-4 text-center text-xs">
                          <Loader2 className="inline size-4 animate-spin" /> Chargement…
                        </td>
                      </tr>
                    ) : lignes.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-muted-foreground p-4 text-center text-xs italic"
                        >
                          Aucune cible.
                        </td>
                      </tr>
                    ) : (
                      lignes.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/30 border-t">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selection.has(l.id)}
                              onChange={() => toggleSelection(l.id)}
                            />
                          </td>
                          <td className="p-2">{l.libelle}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {l.projet_code}
                            </Badge>
                          </td>
                          <td className="p-2">{l.pays_code}</td>
                          <td className="text-muted-foreground max-w-[200px] truncate p-2">
                            {l.email && !l.email.includes('@import-oif-2025.local') ? (
                              l.email
                            ) : (
                              <span className="italic">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground tabular-nums">
                  Page {page + 1} sur {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || pendingListe}
                  >
                    Précédent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page + 1 >= totalPages || pendingListe}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Aperçu strate */}
          <ApercuStrateCard
            apercu={apercu}
            pending={pendingApercu}
            resume={resumerStrate(questionnaire, filtresJsonb)}
            mode={mode}
            selectionSize={selection.size}
            plafond={plafond}
          />
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
                Strate viable — <strong>{eligibles}</strong> destinataires éligibles dans le
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
