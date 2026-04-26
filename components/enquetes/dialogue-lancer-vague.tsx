'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  apercuVagueEnquete,
  lancerVagueEnquete,
  type LancerVagueResult,
} from '@/lib/enquetes/lancer-vague';
import {
  VAGUES_ENQUETE_VALUES,
  VAGUE_ENQUETE_LIBELLES,
} from '@/lib/schemas/enquetes/nomenclatures';
import { cn } from '@/lib/utils';

export type DialogueLancerVagueProps = {
  projets: Array<{ code: string; libelle: string }>;
};

/**
 * Dialogue de lancement d'une vague d'enquête (Étape 6.5e).
 *
 * Workflow :
 *   1. SCS choisit questionnaire + vague + filtres optionnels.
 *   2. Aperçu en temps réel : nombre de cibles éligibles + sans email.
 *   3. Champ optionnel « tester avec un email override » pour validation
 *      avant le grand lancement.
 *   4. Bouton « Lancer » → appel Server Action → résumé { envoyés,
 *      sans email, échecs } dans un toast détaillé.
 */
export function DialogueLancerVague({ projets }: DialogueLancerVagueProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [questionnaire, setQuestionnaire] = useState<'A' | 'B'>('A');
  const [vague, setVague] = useState<string>('ponctuelle');
  const [projetCode, setProjetCode] = useState<string>('');
  const [emailOverride, setEmailOverride] = useState<string>('rifalovi@yahoo.fr');
  const [plafond, setPlafond] = useState<number>(50);
  const [apercu, setApercu] = useState<{
    total: number;
    avec_email: number;
    sans_email: number;
  } | null>(null);
  const [resultat, setResultat] = useState<LancerVagueResult | null>(null);

  // Recharge l'aperçu quand questionnaire ou projet change
  useEffect(() => {
    if (!open) return;
    setApercu(null);
    apercuVagueEnquete({
      questionnaire,
      projet_code: projetCode || undefined,
    }).then((r) => {
      if (r.status === 'succes') {
        setApercu({
          total: r.total_cibles,
          avec_email: r.avec_email,
          sans_email: r.sans_email,
        });
      }
    });
  }, [open, questionnaire, projetCode]);

  const handleLancer = () => {
    setResultat(null);
    startTransition(async () => {
      const r = await lancerVagueEnquete({
        questionnaire,
        vague_enquete: vague,
        projet_code: projetCode || undefined,
        email_test_override: emailOverride || undefined,
        plafond,
      });
      setResultat(r);
      if (r.status === 'succes') {
        toast.success(
          `${r.envoyes} email(s) envoyés · ${r.sans_email.length} sans email · ${r.echecs.length} échec(s)`,
          { duration: 12000 },
        );
        router.refresh();
      } else if (r.status === 'plafond_depasse') {
        toast.error(r.message, { duration: 10000 });
      } else if (r.status === 'erreur_validation') {
        toast.error(`${r.issues.length} erreur(s) de validation`);
      } else if ('message' in r) {
        toast.error(r.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResultat(null);
      }}
    >
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
        <Mail aria-hidden className="size-4" />
        Lancer une vague
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lancer une vague d’enquête</DialogTitle>
          <DialogDescription>
            Génère un token d’enquête publique pour chaque cible et envoie l’invitation par email
            (Resend).
          </DialogDescription>
        </DialogHeader>

        {!resultat ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="questionnaire">Questionnaire</Label>
                <Select
                  value={questionnaire}
                  onValueChange={(v) => setQuestionnaire((v as 'A' | 'B') ?? 'A')}
                >
                  <SelectTrigger id="questionnaire">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Bénéficiaires</SelectItem>
                    <SelectItem value="B">B — Structures</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vague">Vague</Label>
                <Select value={vague} onValueChange={(v) => setVague(v ?? 'ponctuelle')}>
                  <SelectTrigger id="vague">
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
              <Label htmlFor="projet">Projet (optionnel — restreint la sélection)</Label>
              <Select
                value={projetCode || 'tous'}
                onValueChange={(v) => setProjetCode(v === 'tous' ? '' : (v ?? ''))}
              >
                <SelectTrigger id="projet">
                  <SelectValue>
                    {(v: string | null) => {
                      if (!v || v === 'tous') return 'Tous les projets';
                      const p = projets.find((x) => x.code === v);
                      return p ? `${p.code} — ${p.libelle}` : v;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les projets</SelectItem>
                  {projets.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.code} — {p.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="plafond">Plafond cibles</Label>
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
                <p className="text-muted-foreground text-xs">Resend Free : 100/jour.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="email_override">Email test (override)</Label>
                <Input
                  id="email_override"
                  type="email"
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                  placeholder="rifalovi@yahoo.fr"
                />
                <p className="text-muted-foreground text-xs">Vide = vrais destinataires.</p>
              </div>
            </div>

            {apercu && (
              <Card>
                <CardContent className="bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Cibles dans le périmètre :</span>
                    <Badge variant="outline">{apercu.total}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-green-700 dark:text-green-400">
                      Avec email + consentement RGPD :
                    </span>
                    <Badge>{apercu.avec_email}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-amber-700 dark:text-amber-400">Sans email valide :</span>
                    <Badge variant="secondary">{apercu.sans_email}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : resultat.status === 'succes' ? (
          <ResultatLancement resultat={resultat} />
        ) : (
          <Card>
            <CardContent className="bg-destructive/5 text-destructive flex items-center gap-2 p-3 text-sm">
              <AlertTriangle aria-hidden className="size-4" />
              {'message' in resultat ? resultat.message : 'Erreur inconnue.'}
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          {!resultat ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleLancer} disabled={pending}>
                <Send aria-hidden className="size-4" />
                {pending ? 'Lancement…' : 'Lancer la vague'}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultatLancement({
  resultat,
}: {
  resultat: Extract<LancerVagueResult, { status: 'succes' }>;
}) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex items-center gap-2 p-3 text-sm">
          <CheckCircle2 aria-hidden className="size-5 text-green-600" />
          <div>
            <strong>{resultat.envoyes}</strong> email(s) envoyés sur{' '}
            <strong>{resultat.total_cibles}</strong> cible(s).
          </div>
        </CardContent>
      </Card>

      {resultat.sans_email.length > 0 && (
        <Card>
          <CardContent className="bg-amber-50/50 p-3 text-xs dark:bg-amber-950/30">
            <p className="mb-1 font-medium">
              {resultat.sans_email.length} cible(s) sans email — à relancer manuellement :
            </p>
            <ul className="text-muted-foreground max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
              {resultat.sans_email.slice(0, 20).map((c) => (
                <li key={c.id}>{c.libelle}</li>
              ))}
              {resultat.sans_email.length > 20 && (
                <li className="italic">… et {resultat.sans_email.length - 20} de plus</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {resultat.echecs.length > 0 && (
        <Card>
          <CardContent className="bg-destructive/5 text-destructive p-3 text-xs">
            <p className="mb-1 font-medium">{resultat.echecs.length} échec(s) :</p>
            <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
              {resultat.echecs.slice(0, 10).map((c) => (
                <li key={c.id}>
                  {c.libelle} — {c.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
