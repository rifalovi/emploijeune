'use client';

/**
 * Interface admin — Liens de collecte publique
 * Gestion des liens (création, activation/désactivation) + suivi et validation
 * des soumissions en attente.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Link2,
  Plus,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  AlertCircle,
  User,
  Building2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  creerLienCollecte,
  basculerStatutLien,
  supprimerLienCollecte,
  listerSoumissions,
  validerSoumission,
  rejeterSoumission,
} from '@/lib/collecte-publique/actions';
import type {
  LienCollecte,
  SoumissionCollecte,
  TypeCollecte,
} from '@/lib/collecte-publique/actions';
import { PROJETS_CODES } from '@/lib/schemas/nomenclatures';

// =============================================================================
// Composant principal
// =============================================================================

type Props = {
  liensInitiaux: LienCollecte[];
  soumissionsInitiales: SoumissionCollecte[];
  peutCreer: boolean;
  peutValider: boolean;
};

export function CollectePubliqueClient({
  liensInitiaux,
  soumissionsInitiales,
  peutCreer,
  peutValider,
}: Props) {
  const router = useRouter();
  const [liens, setLiens] = useState(liensInitiaux);
  const [soumissions, setSoumissions] = useState(soumissionsInitiales);
  const [onglet, setOnglet] = useState<'liens' | 'soumissions'>('liens');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'en_attente' | 'valide' | 'rejete'>('en_attente');
  const [filtreLien, setFiltreLien] = useState<string>('tous');

  // Dialogue création lien
  const [dialogCreation, setDialogCreation] = useState(false);

  // Dialogue détail soumission
  const [soumissionDetail, setSoumissionDetail] = useState<SoumissionCollecte | null>(null);
  const [dialogDetail, setDialogDetail] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');

  // Dialogue confirmation suppression lien
  const [lienASupprimer, setLienASupprimer] = useState<LienCollecte | null>(null);

  const [isPending, startTransition] = useTransition();
  const [copie, setCopie] = useState<string | null>(null);

  const soumissionsFiltrees = soumissions.filter((s) => {
    const matchStatut = filtreStatut === 'tous' || s.statut === filtreStatut;
    const matchLien = filtreLien === 'tous' || s.lien_id === filtreLien;
    return matchStatut && matchLien;
  });

  const nbEnAttente = soumissions.filter((s) => s.statut === 'en_attente').length;

  function copierURL(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopie(id);
      setTimeout(() => setCopie(null), 2000);
    });
  }

  function rafraichirSoumissions() {
    startTransition(async () => {
      const result = await listerSoumissions();
      if (result.status === 'succes') {
        setSoumissions(result.soumissions);
      }
    });
  }

  function ouvrirDetail(soumission: SoumissionCollecte) {
    setSoumissionDetail(soumission);
    setMotifRejet('');
    setDialogDetail(true);
  }

  function handleValider(id: string) {
    startTransition(async () => {
      const result = await validerSoumission(id);
      if (result.status === 'succes') {
        setSoumissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, statut: 'valide', entite_creee_id: result.entite_id } : s)),
        );
        setDialogDetail(false);
        router.refresh();
      }
    });
  }

  function handleRejeter(id: string) {
    if (!motifRejet.trim()) return;
    startTransition(async () => {
      const result = await rejeterSoumission(id, motifRejet);
      if (result.status === 'succes') {
        setSoumissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, statut: 'rejete', motif_rejet: motifRejet } : s)),
        );
        setDialogDetail(false);
      }
    });
  }

  function handleSupprimer(lienId: string) {
    startTransition(async () => {
      const result = await supprimerLienCollecte(lienId);
      if (result.status === 'succes') {
        setLiens((prev) => prev.filter((l) => l.id !== lienId));
      }
      setLienASupprimer(null);
    });
  }

  function handleBasculer(lienId: string, statutActuel: string) {
    const nouveau = statutActuel === 'actif' ? 'inactif' : 'actif';
    startTransition(async () => {
      const result = await basculerStatutLien(lienId, nouveau as 'actif' | 'inactif');
      if (result.status === 'succes') {
        setLiens((prev) =>
          prev.map((l) => (l.id === lienId ? { ...l, statut: result.nouveau_statut } : l)),
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collecte publique</h1>
          <p className="text-muted-foreground text-sm">
            Liens réutilisables pour l'enregistrement sans compte — Type A (bénéficiaires) ou Type B (structures)
          </p>
        </div>
        {peutCreer && (
          <Button
            onClick={() => setDialogCreation(true)}
            className="bg-[#5D0073] hover:bg-[#4a005c]"
          >
            <Plus className="mr-2 size-4" />
            Nouveau lien
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Liens actifs</p>
            <p className="text-2xl font-bold text-[#5D0073]">
              {liens.filter((l) => l.statut === 'actif').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total soumissions</p>
            <p className="text-2xl font-bold">{soumissions.length}</p>
          </CardContent>
        </Card>
        <Card className={nbEnAttente > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">En attente de validation</p>
            <p className={`text-2xl font-bold ${nbEnAttente > 0 ? 'text-amber-700' : ''}`}>
              {nbEnAttente}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Tabs value={onglet} onValueChange={(v) => setOnglet(v as typeof onglet)}>
        <TabsList>
          <TabsTrigger value="liens">
            <Link2 className="mr-1.5 size-4" />
            Liens ({liens.length})
          </TabsTrigger>
          <TabsTrigger value="soumissions" className="relative">
            <Eye className="mr-1.5 size-4" />
            Soumissions ({soumissions.length})
            {nbEnAttente > 0 && (
              <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
                {nbEnAttente}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== Onglet LIENS ===== */}
        <TabsContent value="liens" className="mt-4">
          {liens.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Link2 className="text-muted-foreground mx-auto mb-3 size-10" />
                <p className="text-muted-foreground text-sm">Aucun lien de collecte créé.</p>
                {peutCreer && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDialogCreation(true)}
                  >
                    Créer le premier lien
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {liens.map((lien) => (
                <LienCard
                  key={lien.id}
                  lien={lien}
                  copie={copie}
                  isPending={isPending}
                  peutValider={peutValider}
                  onCopier={copierURL}
                  onBasculer={handleBasculer}
                  onSupprimer={(l) => setLienASupprimer(l)}
                  onVoirSoumissions={(id) => {
                    setFiltreLien(id);
                    setFiltreStatut('tous');
                    setOnglet('soumissions');
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Onglet SOUMISSIONS ===== */}
        <TabsContent value="soumissions" className="mt-4">
          {/* Filtres */}
          <div className="mb-4 flex gap-3">
            <Select
              value={filtreStatut}
              onValueChange={(v) => setFiltreStatut(v as typeof filtreStatut)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="valide">Validées</SelectItem>
                <SelectItem value="rejete">Rejetées</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filtreLien}
              onValueChange={(v) => setFiltreLien(v ?? '')}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Tous les liens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les liens</SelectItem>
                {liens.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label || l.slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={rafraichirSoumissions} disabled={isPending}>
              Actualiser
            </Button>
          </div>

          {soumissionsFiltrees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">Aucune soumission pour ce filtre.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Lien</TableHead>
                    <TableHead>Données principales</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soumissionsFiltrees.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge variant={s.type === 'A' ? 'default' : 'secondary'} className="font-mono">
                          {s.type === 'A' ? (
                            <><User className="mr-1 size-3" /> Bénéf.</>
                          ) : (
                            <><Building2 className="mr-1 size-3" /> Structure</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[120px] truncate text-xs">
                        {s.lien_label || s.lien_slug}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm font-medium">
                          {s.type === 'A'
                            ? `${s.donnees['prenom'] ?? ''} ${s.donnees['nom'] ?? ''}`
                            : (s.donnees['nom_structure'] as string) ?? '–'}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {(s.donnees['pays_code'] as string) ?? ''}
                          {s.donnees['projet_code'] ? ` · ${s.donnees['projet_code']}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(s.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <StatutBadge statut={s.statut} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ouvrirDetail(s)}
                        >
                          <Eye className="mr-1 size-4" />
                          Détail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Dialog création lien ===== */}
      <DialogCreerLien
        open={dialogCreation}
        onClose={() => setDialogCreation(false)}
        onCreated={(nouveau) => {
          setLiens((prev) => [nouveau, ...prev]);
          setDialogCreation(false);
        }}
      />

      {/* ===== Dialog détail soumission ===== */}
      {soumissionDetail && (
        <Dialog open={dialogDetail} onOpenChange={setDialogDetail}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {soumissionDetail.type === 'A' ? (
                  <User className="size-5 text-[#5D0073]" />
                ) : (
                  <Building2 className="size-5 text-[#5D0073]" />
                )}
                Soumission {soumissionDetail.type === 'A' ? 'bénéficiaire' : 'structure'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Détail de la soumission et actions de validation
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Méta */}
              <div className="flex items-center gap-3 text-sm">
                <StatutBadge statut={soumissionDetail.statut} />
                <span className="text-muted-foreground">
                  Reçu le {new Date(soumissionDetail.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </span>
                <span className="text-muted-foreground">· Lien : {soumissionDetail.lien_label || soumissionDetail.lien_slug}</span>
              </div>

              {/* Données */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-3 text-sm font-semibold">Données soumises</h3>
                <DonneesGrid donnees={soumissionDetail.donnees} type={soumissionDetail.type} />
              </div>

              {soumissionDetail.motif_rejet && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Motif de rejet :</p>
                    <p>{soumissionDetail.motif_rejet}</p>
                  </div>
                </div>
              )}

              {soumissionDetail.entite_creee_id && (
                <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 className="size-4" />
                  Intégré en base — ID : <code className="font-mono text-xs">{soumissionDetail.entite_creee_id}</code>
                </div>
              )}

              {/* Note RGPD consentement */}
              {soumissionDetail.statut === 'en_attente' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>Rappel :</strong> La validation créera l'entité avec{' '}
                  <em>consentement = false</em> (statut « incomplet »). Confirmez le consentement
                  RGPD directement avec le porteur avant de modifier.
                </div>
              )}
            </div>

            {/* Actions de validation */}
            {soumissionDetail.statut === 'en_attente' && peutValider && (
              <div className="space-y-3 border-t pt-4">
                {/* Rejet */}
                <div className="space-y-1.5">
                  <Label htmlFor="motif">Motif de rejet (obligatoire pour rejeter)</Label>
                  <Textarea
                    id="motif"
                    value={motifRejet}
                    onChange={(e) => setMotifRejet(e.target.value)}
                    placeholder="Expliquez pourquoi cette soumission est rejetée…"
                    rows={2}
                  />
                </div>
                <DialogFooter className="flex-row gap-2">
                  <Button
                    variant="destructive"
                    disabled={!motifRejet.trim() || isPending}
                    onClick={() => handleRejeter(soumissionDetail.id)}
                  >
                    <XCircle className="mr-2 size-4" />
                    Rejeter
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isPending}
                    onClick={() => handleValider(soumissionDetail.id)}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Valider et intégrer
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Dialog confirmation suppression lien ===== */}
      <Dialog open={!!lienASupprimer} onOpenChange={(o) => { if (!o) setLienASupprimer(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Supprimer ce lien ?
            </DialogTitle>
            <DialogDescription>
              Le lien <strong>{lienASupprimer?.label || lienASupprimer?.slug}</strong> sera
              définitivement supprimé. Les soumissions associées seront également retirées.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setLienASupprimer(null)} disabled={isPending}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => lienASupprimer && handleSupprimer(lienASupprimer.id)}
            >
              <Trash2 className="mr-2 size-4" />
              {isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Sous-composants
// =============================================================================

function LienCard({
  lien,
  copie,
  isPending,
  peutValider,
  onCopier,
  onBasculer,
  onSupprimer,
  onVoirSoumissions,
}: {
  lien: LienCollecte;
  copie: string | null;
  isPending: boolean;
  peutValider: boolean;
  onCopier: (url: string, id: string) => void;
  onBasculer: (id: string, statut: string) => void;
  onSupprimer: (lien: LienCollecte) => void;
  onVoirSoumissions: (id: string) => void;
}) {

  return (
    <Card className={lien.statut === 'inactif' ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant={lien.type === 'A' ? 'default' : 'secondary'} className="shrink-0">
              {lien.type === 'A' ? 'Type A – Bénéf.' : 'Type B – Structure'}
            </Badge>
            <div className="min-w-0">
              <CardTitle className="truncate text-sm">
                {lien.label || `Lien ${lien.slug}`}
              </CardTitle>
              {lien.projet_code && (
                <CardDescription className="font-mono text-xs">{lien.projet_code}</CardDescription>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {lien.statut === 'expire' ? (
              <Badge variant="destructive">Expiré</Badge>
            ) : (
              <Badge variant={lien.statut === 'actif' ? 'default' : 'outline'} className={lien.statut === 'actif' ? 'bg-green-100 text-green-800 border-green-300' : ''}>
                {lien.statut === 'actif' ? 'Actif' : 'Inactif'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* URL + Copier */}
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <code className="flex-1 truncate text-xs text-muted-foreground">{lien.url}</code>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-7 px-2"
            onClick={() => onCopier(lien.url, lien.id)}
          >
            {copie === lien.id ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" asChild>
            <a href={lien.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">
            Total : <strong>{lien.nb_total}</strong>
          </span>
          {lien.nb_en_attente > 0 && (
            <span className="font-medium text-amber-700">
              <Clock className="mr-0.5 inline size-3" />
              {lien.nb_en_attente} en attente
            </span>
          )}
          {lien.nb_valide > 0 && (
            <span className="text-green-700">
              <CheckCircle2 className="mr-0.5 inline size-3" />
              {lien.nb_valide} validées
            </span>
          )}
          {lien.nb_rejete > 0 && (
            <span className="text-destructive">
              <XCircle className="mr-0.5 inline size-3" />
              {lien.nb_rejete} rejetées
            </span>
          )}
          {lien.expire_at && (
            <span className="text-muted-foreground">
              Expire : {new Date(lien.expire_at).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {lien.nb_total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVoirSoumissions(lien.id)}
            >
              <Eye className="mr-1 size-4" />
              Voir les soumissions
            </Button>
          )}
          {peutValider && lien.statut !== 'expire' && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => onBasculer(lien.id, lien.statut)}
            >
              {lien.statut === 'actif' ? (
                <><ToggleRight className="mr-1 size-4 text-green-600" /> Désactiver</>
              ) : (
                <><ToggleLeft className="mr-1 size-4" /> Activer</>
              )}
            </Button>
          )}
          {peutValider && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
              onClick={() => onSupprimer(lien)}
            >
              <Trash2 className="mr-1 size-4" />
              Supprimer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === 'en_attente') return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
      <Clock className="mr-1 size-3" /> En attente
    </Badge>
  );
  if (statut === 'valide') return (
    <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
      <CheckCircle2 className="mr-1 size-3" /> Validée
    </Badge>
  );
  return (
    <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
      <XCircle className="mr-1 size-3" /> Rejetée
    </Badge>
  );
}

function DonneesGrid({
  donnees,
  type,
}: {
  donnees: Record<string, unknown>;
  type: TypeCollecte;
}) {
  const champsA = [
    ['Prénom', 'prenom'], ['Nom', 'nom'], ['Sexe', 'sexe'],
    ['Tranche âge', 'tranche_age_declaree'], ['Pays', 'pays_code'],
    ['Projet', 'projet_code'], ['Domaine formation', 'domaine_formation_code'],
    ['Année formation', 'annee_formation'], ['Téléphone', 'telephone'],
    ['Courriel', 'courriel'], ['Consentement', 'consentement_recueilli'],
  ] as [string, string][];

  const champsB = [
    ['Nom structure', 'nom_structure'], ['Type', 'type_structure'],
    ['Secteur', 'secteur_activite'], ['Statut', 'statut_creation'],
    ['Année appui', 'annee_appui'], ['Nature appui', 'nature_appui'],
    ['Projet', 'projet_code'], ['Pays', 'pays_code'],
    ['Porteur – nom', 'porteur_nom'], ['Porteur – prénom', 'porteur_prenom'],
    ['Porteur – sexe', 'porteur_sexe'], ['Téléphone', 'telephone'],
    ['Courriel', 'courriel'], ['Initiative', 'intitule_initiative'],
    ['Consentement', 'consentement_recueilli'],
  ] as [string, string][];

  const champs = type === 'A' ? champsA : champsB;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {champs.map(([label, clef]) => {
        const valeur = donnees[clef];
        if (valeur === null || valeur === undefined || valeur === '') return null;
        return (
          <div key={clef} className="flex gap-2">
            <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
            <span className="font-medium">
              {typeof valeur === 'boolean' ? (valeur ? 'Oui' : 'Non') : String(valeur)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Dialog de création d'un lien
// =============================================================================

function DialogCreerLien({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lien: LienCollecte) => void;
}) {
  const [type, setType] = useState<TypeCollecte>('A');
  const [label, setLabel] = useState('');
  const [projetCode, setProjetCode] = useState('');
  const [expireDans, setExpireDans] = useState('');
  const [erreur, setErreur] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    startTransition(async () => {
      const result = await creerLienCollecte({
        type,
        label,
        projet_code: projetCode || null,
        expire_dans_jours: expireDans ? Number(expireDans) : null,
      });
      if (result.status === 'succes') {
        onCreated(result.lien);
        // Reset form
        setType('A');
        setLabel('');
        setProjetCode('');
        setExpireDans('');
      } else {
        setErreur(result.message ?? 'Erreur lors de la création.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau lien de collecte publique</DialogTitle>
          <DialogDescription>
            Générez un lien réutilisable à partager (WhatsApp, affiche, QR code…) pour permettre l'enregistrement sans compte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type de collecte <span className="text-destructive">*</span></Label>
            <Select value={type} onValueChange={(v) => setType(v as TypeCollecte)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-[#5D0073]" />
                    <span>Type A — Bénéficiaire (formulaire A1)</span>
                  </div>
                </SelectItem>
                <SelectItem value="B">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-[#5D0073]" />
                    <span>Type B — Structure partenaire (formulaire B1)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label">Libellé du lien <span className="text-destructive">*</span></Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. : Formation numérique Dakar – Été 2026"
              required
            />
            <p className="text-muted-foreground text-xs">
              Visible uniquement dans le back-office pour identifier le lien.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Projet OIF associé</Label>
            <Select value={projetCode || '_aucun'} onValueChange={(v) => setProjetCode(v === '_aucun' || v === null ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Optionnel — pré-remplit le formulaire" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="_aucun">Aucun (à renseigner par le participant)</SelectItem>
                {PROJETS_CODES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expire">Expiration (en jours)</Label>
            <Input
              id="expire"
              type="number"
              min={1}
              max={365}
              value={expireDans}
              onChange={(e) => setExpireDans(e.target.value)}
              placeholder="Laisser vide = pas d'expiration"
            />
          </div>

          {erreur && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {erreur}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!label.trim() || isPending}
              className="bg-[#5D0073] hover:bg-[#4a005c]"
            >
              {isPending ? 'Création…' : 'Créer le lien'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
