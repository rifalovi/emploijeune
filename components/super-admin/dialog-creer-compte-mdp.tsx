'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { creerCompteAvecMotPasseDefini } from '@/lib/super-admin/server-actions';

/**
 * Dialog de création de compte avec mot de passe défini par le super_admin.
 *
 * Différence avec le flux d'invitation par email (formulaire-creer-compte.tsx) :
 * ici, le super_admin SAISIT lui-même le mot de passe et le communique
 * manuellement à l'utilisateur (WhatsApp, SMS, en personne). Aucun email
 * d'invitation n'est envoyé. À la première connexion, le middleware
 * détecte `mdp_temporaire=true` et redirige vers /mon-compte pour
 * forcer le changement.
 */

const ROLES_OPTIONS = [
  { value: 'admin_scs', label: 'Administrateur SCS' },
  { value: 'editeur_projet', label: 'Éditeur projet' },
  { value: 'contributeur_partenaire', label: 'Contributeur partenaire' },
  { value: 'lecteur', label: 'Lecteur' },
] as const;

type Organisation = { id: string; nom: string };

export function DialogCreerCompteAvecMdp({ organisations }: { organisations: Organisation[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [nomComplet, setNomComplet] = useState('');
  const [role, setRole] = useState<(typeof ROLES_OPTIONS)[number]['value']>('lecteur');
  const [organisationId, setOrganisationId] = useState<string>('_aucune');
  const [motPasse, setMotPasse] = useState('');
  const [mdpVisible, setMdpVisible] = useState(false);
  const [copie, setCopie] = useState(false);

  const reset = () => {
    setEmail('');
    setNomComplet('');
    setRole('lecteur');
    setOrganisationId('_aucune');
    setMotPasse('');
    setMdpVisible(false);
    setCopie(false);
  };

  const genererMdp = () => {
    // 12 chars : 8 alphanum + 2 symboles + 2 digits — suffisant pour
    // un mot de passe temporaire qui sera changé au premier login.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const sym = '!@#$%';
    const get = (s: string) => s[Math.floor(Math.random() * s.length)];
    const mdp = Array.from({ length: 10 }, () => get(chars)).join('') + get(sym) + get('23456789');
    setMotPasse(mdp);
    setMdpVisible(true);
  };

  const onSubmit = () => {
    if (motPasse.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    startTransition(async () => {
      const res = await creerCompteAvecMotPasseDefini({
        email: email.trim(),
        nom_complet: nomComplet.trim(),
        role,
        organisation_id: organisationId === '_aucune' ? null : organisationId,
        mot_passe: motPasse,
      });
      if (res.status === 'erreur') {
        const map: Record<string, string> = {
          email_deja_utilise: 'Cette adresse email est déjà utilisée par un compte existant.',
          reserve_super_admin: 'Action réservée au super_admin.',
        };
        toast.error(map[res.message] ?? `Échec : ${res.message}`);
        return;
      }
      toast.success(`Compte créé pour ${email}.`);
      router.refresh();
      // Ne ferme pas le dialog : l'admin doit pouvoir copier le mdp
      // une dernière fois. La fermeture est manuelle via le bouton.
    });
  };

  const copierCredentials = () => {
    const text = `Email : ${email}\nMot de passe : ${motPasse}\n\nConnectez-vous sur ${typeof window !== 'undefined' ? window.location.origin : 'https://suivi-projet.org'} avec ces identifiants. Vous serez invité(e) à changer votre mot de passe à la première connexion.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[#0E4F88] hover:bg-[#1565a8]"
        size="sm"
      >
        <UserPlus className="mr-2 size-4" aria-hidden />
        Créer un compte (mdp défini)
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          setOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#0E4F88]" aria-hidden />
              Nouveau compte avec mot de passe
            </DialogTitle>
            <DialogDescription>
              Le compte est immédiatement actif. Le mot de passe est temporaire — l&apos;utilisateur
              sera invité à le changer à sa première connexion. Aucun email d&apos;invitation
              n&apos;est envoyé : communiquez les identifiants manuellement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="email_compte">Adresse email *</Label>
              <Input
                id="email_compte"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="utilisateur@organisation.org"
                disabled={pending}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nom_complet">Nom complet *</Label>
              <Input
                id="nom_complet"
                type="text"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                placeholder="Prénom Nom"
                disabled={pending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Rôle *</Label>
                <Select
                  value={role}
                  onValueChange={(v: string | null) => setRole((v ?? 'lecteur') as typeof role)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Organisation</Label>
                <Select
                  value={organisationId}
                  onValueChange={(v: string | null) => setOrganisationId(v ?? '_aucune')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="_aucune">Aucune</SelectItem>
                    {organisations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mot_passe">Mot de passe temporaire * (8 chars min.)</Label>
                <button
                  type="button"
                  onClick={genererMdp}
                  className="text-xs font-medium text-[#0E4F88] hover:underline"
                  disabled={pending}
                >
                  Générer un mdp fort
                </button>
              </div>
              <div className="relative">
                <Input
                  id="mot_passe"
                  type={mdpVisible ? 'text' : 'password'}
                  value={motPasse}
                  onChange={(e) => setMotPasse(e.target.value)}
                  placeholder="MotDePasse@123"
                  disabled={pending}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setMdpVisible((v) => !v)}
                  className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label={mdpVisible ? 'Masquer' : 'Afficher'}
                  disabled={pending}
                >
                  {mdpVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {motPasse && email && (
                <button
                  type="button"
                  onClick={copierCredentials}
                  className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-[#0E4F88] hover:underline"
                  disabled={pending}
                >
                  {copie ? (
                    <>
                      <Check className="size-3" aria-hidden />
                      Identifiants copiés
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" aria-hidden />
                      Copier email + mdp pour communication
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={pending || !email.trim() || !nomComplet.trim() || motPasse.length < 8}
              className="bg-[#0E4F88] hover:bg-[#1565a8]"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Création…
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" aria-hidden />
                  Créer le compte
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
