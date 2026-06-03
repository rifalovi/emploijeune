'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  sauvegarderBloc,
  mettreAJourValeur,
  mettreAJourType,
  supprimerBloc,
  supprimerSection,
  renommerSection,
  reordonnerBlocs,
  toggleActifBloc,
} from '@/lib/contenu-pages/actions';
import type { ContenuBloc } from '@/lib/contenu-pages/queries';
import type { TypeContenu } from '@/lib/contenu-pages/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPES_CONTENU: { value: TypeContenu; label: string; color: string }[] = [
  { value: 'h1',        label: 'H1 — Titre principal',   color: 'bg-blue-600 text-white' },
  { value: 'h2',        label: 'H2 — Titre section',     color: 'bg-blue-400 text-white' },
  { value: 'h3',        label: 'H3 — Sous-titre',        color: 'bg-sky-400 text-white' },
  { value: 'sous_titre',label: 'Chapeau',                 color: 'bg-slate-500 text-white' },
  { value: 'texte',     label: 'Texte courant',           color: 'bg-slate-300 text-slate-800' },
  { value: 'badge',     label: 'Badge / étiquette',       color: 'bg-amber-400 text-white' },
  { value: 'citation',  label: 'Citation',                color: 'bg-purple-500 text-white' },
  { value: 'lien',      label: 'Lien / bouton',           color: 'bg-emerald-500 text-white' },
];

const PAGE_LABELS: Record<string, string> = {
  accueil:      'Accueil (/)',
  realisations: 'Réalisations',
  referentiels: 'Référentiels',
  contact:      'Contact',
};

function typeBadge(type: string) {
  const t = TYPES_CONTENU.find((x) => x.value === type);
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t?.color ?? 'bg-slate-200 text-slate-700'}`}>
      {t?.label.split('—')[0]?.trim() ?? type}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  pages: string[];
  pageActive: string;
  blocs: ContenuBloc[];
};

type NouveauBlocState = {
  section_key: string;
  bloc_key: string;
  type_contenu: TypeContenu;
  valeur: string;
};

// ── Composant principal ───────────────────────────────────────────────────────

export function ContenuPagesClient({ pages, pageActive, blocs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Regroupe les blocs par section
  const sections = groupParSection(blocs);
  const sectionKeys = Object.keys(sections);

  // État ouvert/fermé des accordéons
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set(sectionKeys));
  const toggleSection = (key: string) =>
    setOuvertes((prev) => {
      const n = new Set(prev);
      if (n.has(key)) { n.delete(key); } else { n.add(key); }
      return n;
    });

  // Dialog nouveau bloc
  const [dialogBloc, setDialogBloc] = useState<NouveauBlocState | null>(null);

  // Dialog nouvelle section
  const [dialogSection, setDialogSection] = useState(false);
  const [nouvelleSectionKey, setNouvelleSectionKey] = useState('');

  // Dialog renommer section
  const [renomDialog, setRenomDialog] = useState<{ ancien: string; nouveau: string } | null>(null);

  function naviguerPage(p: string) {
    router.push(`/super-admin/contenu-pages?page=${p}`);
  }

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  async function handleSupprimerSection(sectionKey: string) {
    if (!confirm(`Supprimer toute la section « ${sectionKey} » et ses ${sections[sectionKey]?.length ?? 0} blocs ?`)) return;
    startTransition(async () => {
      const res = await supprimerSection(pageActive, sectionKey);
      if (res.ok) { toast.success('Section supprimée'); router.refresh(); }
      else toast.error(res.message);
    });
  }

  async function handleRenommerSection() {
    if (!renomDialog || !renomDialog.nouveau.trim()) return;
    startTransition(async () => {
      const res = await renommerSection(pageActive, renomDialog.ancien, renomDialog.nouveau.trim());
      if (res.ok) { toast.success('Section renommée'); setRenomDialog(null); router.refresh(); }
      else toast.error(res.message);
    });
  }

  async function handleAjouterBloc() {
    if (!dialogBloc) return;
    if (!dialogBloc.bloc_key.trim()) { toast.error('La clé du bloc est requise.'); return; }
    startTransition(async () => {
      const maxOrdre = Math.max(0, ...(sections[dialogBloc.section_key]?.map((b) => b.ordre) ?? []));
      const res = await sauvegarderBloc({
        page_key: pageActive,
        section_key: dialogBloc.section_key,
        bloc_key: dialogBloc.bloc_key.trim().toLowerCase().replace(/\s+/g, '_'),
        type_contenu: dialogBloc.type_contenu,
        valeur: dialogBloc.valeur,
        ordre: maxOrdre + 10,
      });
      if (res.ok) { toast.success('Bloc ajouté'); setDialogBloc(null); router.refresh(); }
      else toast.error(res.message);
    });
  }

  async function handleAjouterSection() {
    const key = nouvelleSectionKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key) { toast.error('Clé de section requise.'); return; }
    // Crée un premier bloc vide de type texte pour matérialiser la section
    startTransition(async () => {
      const res = await sauvegarderBloc({
        page_key: pageActive,
        section_key: key,
        bloc_key: 'titre',
        type_contenu: 'h2',
        valeur: key,
        ordre: 0,
      });
      if (res.ok) {
        toast.success('Section créée');
        setDialogSection(false);
        setNouvelleSectionKey('');
        router.refresh();
      } else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de page */}
      <div className="flex flex-wrap items-center gap-2">
        {[...pages, ...(pages.includes(pageActive) ? [] : [pageActive])].map((p) => (
          <button
            key={p}
            onClick={() => naviguerPage(p)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              p === pageActive
                ? 'border-[#0E4F88] bg-[#0E4F88] text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {PAGE_LABELS[p] ?? p}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={refresh}
          disabled={isPending}
        >
          <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Liste des sections */}
      {sectionKeys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-400">
          Aucun contenu pour cette page. Ajoutez une section pour commencer.
        </div>
      ) : (
        sectionKeys.map((sectionKey) => (
          <SectionCard
            key={sectionKey}
            sectionKey={sectionKey}
            blocs={sections[sectionKey] ?? []}
            ouverte={ouvertes.has(sectionKey)}
            onToggle={() => toggleSection(sectionKey)}
            onRenommer={() => setRenomDialog({ ancien: sectionKey, nouveau: sectionKey })}
            onSupprimer={() => handleSupprimerSection(sectionKey)}
            onAjouterBloc={() =>
              setDialogBloc({
                section_key: sectionKey,
                bloc_key: '',
                type_contenu: 'texte',
                valeur: '',
              })
            }
            onRefresh={refresh}
          />
        ))
      )}

      {/* Bouton ajouter section */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setDialogSection(true)}
      >
        <Plus className="size-4" />
        Ajouter une section
      </Button>

      {/* Dialog nouveau bloc */}
      <Dialog open={!!dialogBloc} onOpenChange={(o) => { if (!o) setDialogBloc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un bloc — {dialogBloc?.section_key}</DialogTitle>
          </DialogHeader>
          {dialogBloc && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type de contenu</label>
                <Select
                  value={dialogBloc.type_contenu}
                  onValueChange={(v) => setDialogBloc({ ...dialogBloc, type_contenu: v as TypeContenu })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES_CONTENU.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Clé du bloc</label>
                <Input
                  placeholder="ex: sous_titre, cta_principal…"
                  value={dialogBloc.bloc_key}
                  onChange={(e) => setDialogBloc({ ...dialogBloc, bloc_key: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  Identifiant unique dans la section. Minuscules, underscores.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contenu</label>
                <textarea
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  rows={4}
                  placeholder="Texte du bloc…"
                  value={dialogBloc.valeur}
                  onChange={(e) => setDialogBloc({ ...dialogBloc, valeur: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogBloc(null)}>Annuler</Button>
            <Button onClick={handleAjouterBloc} disabled={isPending}>
              {isPending ? <RefreshCw className="size-4 animate-spin mr-2" /> : null}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nouvelle section */}
      <Dialog open={dialogSection} onOpenChange={setDialogSection}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle section</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Clé de section</label>
            <Input
              placeholder="ex: intro, partenaires, temoignages…"
              value={nouvelleSectionKey}
              onChange={(e) => setNouvelleSectionKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAjouterSection()}
            />
            <p className="text-muted-foreground text-xs">
              Identifiant unique dans la page. Un premier bloc « titre » sera créé automatiquement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogSection(false)}>Annuler</Button>
            <Button onClick={handleAjouterSection} disabled={isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog renommer section */}
      <Dialog open={!!renomDialog} onOpenChange={(o) => { if (!o) setRenomDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renommer la section</DialogTitle>
          </DialogHeader>
          {renomDialog && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nouvelle clé</label>
              <Input
                value={renomDialog.nouveau}
                onChange={(e) => setRenomDialog({ ...renomDialog, nouveau: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleRenommerSection()}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomDialog(null)}>Annuler</Button>
            <Button onClick={handleRenommerSection} disabled={isPending}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  sectionKey,
  blocs,
  ouverte,
  onToggle,
  onRenommer,
  onSupprimer,
  onAjouterBloc,
  onRefresh,
}: {
  sectionKey: string;
  blocs: ContenuBloc[];
  ouverte: boolean;
  onToggle: () => void;
  onRenommer: () => void;
  onSupprimer: () => void;
  onAjouterBloc: () => void;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  async function handleDeplacer(bloc: ContenuBloc, dir: 'up' | 'down') {
    const sorted = [...blocs].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((b) => b.id === bloc.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx]!;
    startTransition(async () => {
      await reordonnerBlocs([
        { id: bloc.id, ordre: swap.ordre },
        { id: swap.id, ordre: bloc.ordre },
      ]);
      onRefresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* En-tête section */}
      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {ouverte
            ? <ChevronDown className="size-4 shrink-0 text-slate-400" />
            : <ChevronRight className="size-4 shrink-0 text-slate-400" />}
          <span className="font-mono text-sm font-semibold text-slate-700">{sectionKey}</span>
          <span className="text-muted-foreground text-xs">
            ({blocs.length} bloc{blocs.length > 1 ? 's' : ''})
          </span>
        </button>
        <button
          onClick={onRenommer}
          className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
          title="Renommer la section"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={onSupprimer}
          className="rounded p-1 text-red-400 transition-colors hover:text-red-600"
          title="Supprimer la section"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Contenu section */}
      {ouverte && (
        <div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 w-6"></th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 w-20">Type</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 w-36">Clé</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500">Contenu</th>
                <th className="px-3 py-1.5 text-right text-xs font-medium text-slate-500 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...blocs]
                .sort((a, b) => a.ordre - b.ordre)
                .map((bloc) => (
                  <BlocRow
                    key={bloc.id}
                    bloc={bloc}
                    onDeplacerHaut={() => handleDeplacer(bloc, 'up')}
                    onDeplacerBas={() => handleDeplacer(bloc, 'down')}
                    onRefresh={onRefresh}
                    isPendingParent={isPending}
                  />
                ))}
            </tbody>
          </table>

          {/* Footer section */}
          <div className="border-t bg-slate-50/50 px-4 py-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onAjouterBloc}>
              <Plus className="size-3.5" />
              Ajouter un bloc
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BlocRow ───────────────────────────────────────────────────────────────────

function BlocRow({
  bloc,
  onDeplacerHaut,
  onDeplacerBas,
  onRefresh,
  isPendingParent,
}: {
  bloc: ContenuBloc;
  onDeplacerHaut: () => void;
  onDeplacerBas: () => void;
  onRefresh: () => void;
  isPendingParent: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingValeur, setEditingValeur] = useState(false);
  const [valeurLocale, setValeurLocale] = useState(bloc.valeur);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEditValeur() {
    setEditingValeur(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function saveValeur() {
    setEditingValeur(false);
    if (valeurLocale === bloc.valeur) return;
    startTransition(async () => {
      const res = await mettreAJourValeur(bloc.id, valeurLocale);
      if (!res.ok) { toast.error(res.message); setValeurLocale(bloc.valeur); }
      else toast.success('Sauvegardé', { duration: 1500 });
    });
  }

  async function handleChangeType(type: TypeContenu) {
    startTransition(async () => {
      const res = await mettreAJourType(bloc.id, type);
      if (!res.ok) toast.error(res.message);
      else onRefresh();
    });
  }

  async function handleSupprimer() {
    if (!confirm(`Supprimer le bloc « ${bloc.bloc_key } » ?`)) return;
    startTransition(async () => {
      const res = await supprimerBloc(bloc.id);
      if (!res.ok) toast.error(res.message);
      else onRefresh();
    });
  }

  async function handleToggleActif() {
    startTransition(async () => {
      const res = await toggleActifBloc(bloc.id, !bloc.actif);
      if (!res.ok) toast.error(res.message);
      else onRefresh();
    });
  }

  const loading = isPending || isPendingParent;

  return (
    <tr className={`group transition-colors hover:bg-slate-50/60 ${!bloc.actif ? 'opacity-40' : ''}`}>
      {/* Poignée ordre */}
      <td className="px-2 py-2 text-slate-300">
        <GripVertical className="size-3.5" />
      </td>

      {/* Type — dropdown */}
      <td className="px-2 py-2">
        <Select value={bloc.type_contenu} onValueChange={(v) => handleChangeType(v as TypeContenu)}>
          <SelectTrigger className="h-auto border-none p-0 shadow-none focus:ring-0">
            <SelectValue>{typeBadge(bloc.type_contenu)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPES_CONTENU.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Clé */}
      <td className="px-3 py-2">
        <span className="font-mono text-xs text-slate-500">{bloc.bloc_key}</span>
      </td>

      {/* Valeur — édition inline */}
      <td className="px-3 py-2 max-w-sm" onClick={!editingValeur ? startEditValeur : undefined}>
        {editingValeur ? (
          <textarea
            ref={textareaRef}
            className="w-full rounded border border-blue-300 bg-blue-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={Math.max(2, Math.ceil(valeurLocale.length / 80))}
            value={valeurLocale}
            onChange={(e) => setValeurLocale(e.target.value)}
            onBlur={saveValeur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setValeurLocale(bloc.valeur); setEditingValeur(false); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveValeur();
            }}
          />
        ) : (
          <p
            className="cursor-text rounded px-1 py-0.5 text-sm leading-snug text-slate-700 hover:bg-blue-50 line-clamp-2"
            title={valeurLocale}
          >
            {valeurLocale || <span className="text-slate-300 italic">vide</span>}
            {loading && <RefreshCw className="ml-1 inline size-3 animate-spin text-slate-400" />}
          </p>
        )}
      </td>

      {/* Actions */}
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onDeplacerHaut}
            disabled={loading}
            className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
            title="Monter"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={onDeplacerBas}
            disabled={loading}
            className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
            title="Descendre"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            onClick={handleToggleActif}
            disabled={loading}
            className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
            title={bloc.actif ? 'Désactiver' : 'Activer'}
          >
            {bloc.actif ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-slate-300" />}
          </button>
          <button
            onClick={editingValeur ? saveValeur : startEditValeur}
            disabled={loading}
            className={`rounded p-1 transition-colors disabled:opacity-30 ${
              editingValeur
                ? 'text-blue-600 hover:text-blue-800'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title={editingValeur ? 'Enregistrer' : 'Modifier'}
          >
            {editingValeur ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          </button>
          <button
            onClick={handleSupprimer}
            disabled={loading}
            className="rounded p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
            title="Supprimer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupParSection(blocs: ContenuBloc[]): Record<string, ContenuBloc[]> {
  const result: Record<string, ContenuBloc[]> = {};
  for (const b of blocs) {
    if (!result[b.section_key]) result[b.section_key] = [];
    result[b.section_key]!.push(b);
  }
  return result;
}
