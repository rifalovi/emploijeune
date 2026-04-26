'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  connexionMotPasseSchema,
  connexionMagicLinkSchema,
  type ConnexionMotPasseInput,
  type ConnexionMagicLinkInput,
} from '@/lib/schemas/auth';
import { envoyerMagicLink } from '@/lib/auth/envoyer-magic-link';

/**
 * Formulaire de connexion (Étape 6.5a).
 *
 * Mode par défaut : login + mot de passe (rôles `chef_projet` /
 * `contributeur_partenaire` se connectent plusieurs fois par semaine
 * — magic link à chaque session perçu comme insoutenable).
 *
 * Mode alternatif : lien magique via `?mode=magic-link` (admin_scs
 * principalement). Le formulaire magic-link historique est conservé
 * intact pour compat (cf. cadrage 6.5 § R1).
 *
 * Premier login après création de compte par admin_scs : Supabase pose
 * `user_metadata.mdp_temporaire = true`, et le callback redirige vers
 * `/motpasse/changer` qui force le changement (à brancher dans le
 * callback en 6.5b).
 */
export function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const modeMagicLink = searchParams.get('mode') === 'magic-link';

  return (
    <div className="space-y-3">
      {message === 'compte_refuse' && (
        <Bandeau ton="erreur">
          Votre accès à la plateforme a été refusé. Pour contester cette décision, contactez le SCS.
        </Bandeau>
      )}
      {message === 'compte_inactif' && (
        <Bandeau ton="erreur">Votre compte est désactivé. Contactez le SCS.</Bandeau>
      )}
      {message === 'mdp_change' && (
        <Bandeau ton="succes">
          Mot de passe mis à jour. Connectez-vous avec vos nouveaux identifiants.
        </Bandeau>
      )}
      {message === 'lien_invalide' && (
        <Bandeau ton="erreur">Le lien est invalide. Demandez-en un nouveau ci-dessous.</Bandeau>
      )}
      {message === 'lien_expire' && (
        <Bandeau ton="erreur">
          Ce lien a déjà été utilisé ou a expiré. Cela peut arriver si votre messagerie (Yahoo Mail,
          Outlook, etc.) a un système anti-phishing qui « pré-clique » les liens dans les emails de
          spam pour les vérifier — ce pré-clic consomme votre lien à usage unique. Solution :
          marquez l’email comme « Pas un spam » dans votre messagerie, puis demandez un nouveau lien
          ci-dessous.
        </Bandeau>
      )}

      {modeMagicLink ? (
        <FormulaireMagicLink router={router} />
      ) : (
        <FormulaireMotPasse router={router} searchParams={searchParams} />
      )}
    </div>
  );
}

// =============================================================================
// Mode 1 — Login + mot de passe (DÉFAUT)
// =============================================================================

function FormulaireMotPasse({
  router,
  searchParams,
}: {
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const form = useForm<ConnexionMotPasseInput>({
    resolver: zodResolver(connexionMotPasseSchema),
    defaultValues: { email: '', motDePasse: '' },
  });

  const onSubmit = async (values: ConnexionMotPasseInput) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.motDePasse,
    });

    if (error) {
      toast.error('Connexion impossible', {
        description:
          error.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect.'
            : error.message,
      });
      return;
    }

    // Si le mot de passe est marqué temporaire, on force le changement
    // immédiat (premier login après création par admin_scs).
    const mdpTemporaire = Boolean(
      (data.user?.user_metadata as Record<string, unknown> | null)?.mdp_temporaire,
    );
    const redirect = searchParams.get('redirect') ?? '/dashboard';

    if (mdpTemporaire) {
      router.push(`/motpasse/changer?premier_login=1&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    router.push(redirect);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Se connecter</CardTitle>
        <CardDescription>Email professionnel + mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse courriel</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="prenom.nom@organisation.org"
                      inputMode="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="motDePasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
        </Form>

        <div className="text-muted-foreground mt-4 flex flex-col gap-1 text-center text-xs">
          <Link href="/motpasse-oublie" className="hover:text-foreground underline">
            Mot de passe oublié ?
          </Link>
          <Link
            href="/connexion?mode=magic-link"
            className="hover:text-foreground underline"
            title="Réservé administrateurs SCS"
          >
            Connexion par lien magique (admin SCS)
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Mode 2 — Magic link (alternative SCS, formulaire historique conservé)
// =============================================================================

function FormulaireMagicLink({ router }: { router: ReturnType<typeof useRouter> }) {
  const [sent, setSent] = useState(false);
  const form = useForm<ConnexionMagicLinkInput>({
    resolver: zodResolver(connexionMagicLinkSchema),
    defaultValues: { email: '' },
  });

  // Refacto hotfix 6.5h-quinquies : appel Server Action `envoyerMagicLink`
  // au lieu de `supabase.auth.signInWithOtp` direct. La Server Action
  // utilise admin.generateLink + Resend avec template OIF français,
  // et applique la politique « ne pas révéler l'existence du compte ».
  const onSubmit = async (values: ConnexionMagicLinkInput) => {
    const result = await envoyerMagicLink(values);

    if (result.status === 'erreur_validation') {
      toast.error('Adresse invalide', { description: result.message });
      return;
    }
    if (result.status === 'erreur_inconnue') {
      toast.error('Impossible d’envoyer le lien', { description: result.message });
      return;
    }

    // status === 'succes' : message neutre (compte existant OU non).
    setSent(true);
    toast.success('Si l’adresse correspond à un compte admin SCS, un lien vient d’être envoyé.');
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Demande envoyée</CardTitle>
          <CardDescription>
            Si l’adresse <strong>{form.getValues('email')}</strong> correspond à un compte
            administrateur SCS, un lien de connexion vient de vous être envoyé. Il est valable
            <strong> 1 heure</strong>. Pensez à vérifier vos courriers indésirables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Changer d'adresse
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push('/connexion')}>
            ← Retour à la connexion par mot de passe
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion par lien magique</CardTitle>
        <CardDescription>
          Mode alternatif réservé aux administrateurs SCS. Recevez un lien unique par courriel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse courriel professionnelle</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="prenom.nom@organisation.org"
                      inputMode="email"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Utilisez l'adresse que le SCS connaît pour votre compte.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Envoi en cours…' : 'Recevoir mon lien de connexion'}
            </Button>
          </form>
        </Form>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link href="/connexion" className="hover:text-foreground underline">
            ← Connexion par mot de passe
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Helper bandeau de message
// =============================================================================

function Bandeau({ ton, children }: { ton: 'erreur' | 'succes'; children: React.ReactNode }) {
  const classes =
    ton === 'erreur'
      ? 'border-destructive/50 bg-destructive/5 text-destructive'
      : 'border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400';
  return <div className={`rounded-md border p-3 text-sm ${classes}`}>{children}</div>;
}
