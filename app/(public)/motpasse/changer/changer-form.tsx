'use client';

import { useEffect, useState } from 'react';
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
import { changerMotPasseSchema, type ChangerMotPasseInput } from '@/lib/schemas/auth';

/**
 * Formulaire de changement de mot de passe (Étape 6.5a).
 *
 * Fonctionnement :
 *   - À l'init, vérifie qu'une session Supabase est active (sinon
 *     redirige vers /connexion).
 *   - Soumission : appelle `auth.updateUser({ password })` puis efface
 *     le drapeau `mdp_temporaire` du metadata utilisateur.
 *   - Redirection : vers `redirect` query param (typique : /dashboard)
 *     ou /connexion?message=mdp_change si l'utilisateur s'est arrivé via
 *     un lien de reset (pour reconnexion propre).
 */
export function ChangerMotPasseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifSession, setVerifSession] = useState<'verif' | 'ok' | 'pas_de_session'>('verif');

  const premierLogin = searchParams.get('premier_login') === '1';
  const apresReset = searchParams.get('reset') === '1';
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  // Vérifie qu'une session existe (le user a cliqué sur un lien valide
  // ou est déjà connecté avec mdp temporaire).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setVerifSession(data.session ? 'ok' : 'pas_de_session');
    });
  }, []);

  const form = useForm<ChangerMotPasseInput>({
    resolver: zodResolver(changerMotPasseSchema),
    defaultValues: { nouveauMotPasse: '', confirmation: '' },
  });

  const onSubmit = async (values: ChangerMotPasseInput) => {
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.updateUser({
      password: values.nouveauMotPasse,
      // Efface le drapeau mdp_temporaire (posé par admin_scs en 6.5b).
      data: { mdp_temporaire: false },
    });

    if (error) {
      toast.error('Impossible de changer le mot de passe', { description: error.message });
      return;
    }

    toast.success('Mot de passe mis à jour');

    if (apresReset) {
      // Cas reset : on déconnecte et on renvoie vers connexion pour
      // re-login propre avec le nouveau mdp.
      await supabase.auth.signOut();
      router.push('/connexion?message=mdp_change');
      return;
    }
    // Cas premier login : session valide, on continue vers le dashboard.
    router.push(redirect);
    router.refresh();
  };

  if (verifSession === 'verif') {
    return <div className="bg-muted h-40 animate-pulse rounded-lg" />;
  }

  if (verifSession === 'pas_de_session') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien expiré ou invalide</CardTitle>
          <CardDescription>
            Aucune session active. Le lien de réinitialisation a peut-être expiré (durée 1 h).
            Demandez un nouveau lien depuis la page « Mot de passe oublié ».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push('/motpasse-oublie')}>
            Demander un nouveau lien
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {premierLogin
            ? 'Définissez votre mot de passe'
            : apresReset
              ? 'Réinitialisez votre mot de passe'
              : 'Changer mon mot de passe'}
        </CardTitle>
        <CardDescription>
          Politique : 8 caractères minimum, dont au moins une majuscule et un chiffre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nouveauMotPasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau mot de passe</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Conseil : utilisez une phrase mémorisable, ex.{' '}
                    <code className="bg-muted rounded px-1">Mali2026Bamako</code>.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmer le mot de passe</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Mise à jour…' : 'Enregistrer'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
