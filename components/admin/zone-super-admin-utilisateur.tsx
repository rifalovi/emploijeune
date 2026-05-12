'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Trash2, Loader2, AlertTriangle, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  changerEmailUtilisateur,
  supprimerCompteUtilisateur,
} from '@/lib/super-admin/server-actions';

type Props = {
  userId: string;
  emailActuel: string | null;
  nomComplet: string;
  estLuiMeme: boolean;
};

/**
 * Bloc d'actions réservées super_admin sur la fiche utilisateur :
 *   - Modifier l'email (mise à jour auth.users + miroir public.utilisateurs)
 *   - Supprimer le compte (soft-delete + révocation auth.users)
 *
 * Les server actions vérifient elles-mêmes le rôle super_admin
 * (double garde). Cette UI n'est rendue par la page parente que si le
 * `roleCourant === 'super_admin'`.
 *
 * Protections :
 *   - Auto-modification interdite (le super_admin ne peut pas s'auto-cibler)
 *   - Confirmation par re-saisie de l'email pour la suppression
 *   - Toast feedback sur succès/erreur
 */
export function ZoneSuperAdminUtilisateur({ userId, emailActuel, nomComplet, estLuiMeme }: Props) {
  const router = useRouter();
  const [nouvelEmail, setNouvelEmail] = useState(emailActuel ?? '');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const onChangerEmail = () => {
    if (estLuiMeme) {
      toast.error('Vous ne pouvez pas modifier votre propre email.');
      return;
    }
    const email = nouvelEmail.trim();
    if (!email || email === emailActuel) {
      toast.error('Saisissez une nouvelle adresse email différente.');
      return;
    }
    startTransition(async () => {
      const res = await changerEmailUtilisateur({ user_id: userId, nouvel_email: email });
      if (res.status === 'erreur') {
        const map: Record<string, string> = {
          email_deja_utilise: 'Cette adresse email est déjà utilisée par un autre compte.',
          auto_modification_interdite: 'Vous ne pouvez pas modifier votre propre email.',
        };
        toast.error(map[res.message] ?? `Échec : ${res.message}`);
        return;
      }
      toast.success(`Email mis à jour : ${email}`);
      router.refresh();
    });
  };

  const onSupprimer = () => {
    if (estLuiMeme) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!emailActuel) {
      toast.error('Email du compte introuvable — suppression impossible.');
      return;
    }
    if (confirmationEmail.trim() !== emailActuel) {
      toast.error('La confirmation par email ne correspond pas.');
      return;
    }
    startTransition(async () => {
      const res = await supprimerCompteUtilisateur({
        user_id: userId,
        confirmation_email: confirmationEmail.trim(),
      });
      if (res.status === 'erreur') {
        const map: Record<string, string> = {
          super_admin_non_supprimable: 'Un super_admin ne peut pas être supprimé.',
          confirmation_email_invalide: 'La confirmation par email ne correspond pas.',
          auto_suppression_interdite: 'Vous ne pouvez pas supprimer votre propre compte.',
          utilisateur_introuvable: 'Compte introuvable.',
        };
        toast.error(map[res.message] ?? `Échec : ${res.message}`);
        return;
      }
      toast.success(`Compte de ${nomComplet} supprimé.`);
      router.push('/admin/utilisateurs');
    });
  };

  return (
    <Card className="border-red-200">
      <CardHeader className="bg-red-50/40 pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-red-900">
          <AlertTriangle className="size-4" aria-hidden />
          Zone super administrateur
        </CardTitle>
        <CardDescription className="text-red-900/80">
          Actions sensibles réservées au super_admin. Auditées et irréversibles.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* Modification email */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Mail className="size-4" aria-hidden />
            Modifier l&apos;adresse email
          </div>
          <p className="text-muted-foreground text-xs">
            Met à jour l&apos;email dans <code>auth.users</code>. L&apos;utilisateur devra utiliser
            la nouvelle adresse à sa prochaine connexion. Pas de mail de confirmation envoyé.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="nouvel_email" className="text-xs">
                Nouvel email
              </Label>
              <Input
                id="nouvel_email"
                type="email"
                value={nouvelEmail}
                onChange={(e) => setNouvelEmail(e.target.value)}
                placeholder={emailActuel ?? 'nouveau@exemple.org'}
                disabled={pending || estLuiMeme}
              />
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onChangerEmail}
              disabled={pending || estLuiMeme || !nouvelEmail.trim() || nouvelEmail.trim() === emailActuel}
            >
              {pending ? (
                <Loader2 className="mr-2 size-3 animate-spin" aria-hidden />
              ) : (
                <Save className="mr-2 size-3" aria-hidden />
              )}
              Mettre à jour
            </Button>
          </div>
          {estLuiMeme && (
            <p className="text-xs text-amber-700">
              Vous ne pouvez pas modifier votre propre email depuis cette interface.
            </p>
          )}
        </section>

        <hr className="border-red-100" />

        {/* Suppression compte */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <Trash2 className="size-4" aria-hidden />
            Supprimer définitivement le compte
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Soft-delete dans la table <code>utilisateurs</code> (préservation de l&apos;historique
            d&apos;audit) + suppression dans <code>auth.users</code> (révoque les sessions et libère
            l&apos;email). Action irréversible.
          </p>
          <p className="text-xs text-slate-600">
            Pour confirmer, saisissez l&apos;email du compte :{' '}
            <code className="font-mono text-slate-900">{emailActuel ?? '(inconnu)'}</code>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="confirmation_email" className="text-xs">
                Confirmation email
              </Label>
              <Input
                id="confirmation_email"
                type="email"
                value={confirmationEmail}
                onChange={(e) => setConfirmationEmail(e.target.value)}
                placeholder={emailActuel ?? ''}
                disabled={pending || estLuiMeme}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onSupprimer}
              disabled={
                pending ||
                estLuiMeme ||
                !confirmationEmail.trim() ||
                confirmationEmail.trim() !== emailActuel
              }
            >
              {pending ? (
                <Loader2 className="mr-2 size-3 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-2 size-3" aria-hidden />
              )}
              Supprimer le compte
            </Button>
          </div>
          {estLuiMeme && (
            <p className="text-xs text-amber-700">
              Vous ne pouvez pas supprimer votre propre compte.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
