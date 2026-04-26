'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  changerMonMotPasse,
  changerMonMotPasseSchema,
  type ChangerMonMotPasseInput,
} from '@/lib/utilisateurs/mon-compte';

/**
 * Formulaire de changement du mot de passe par l'utilisateur lui-même
 * (Mon Compte). Vérifie l'ancien mdp avant de le changer (sécurité
 * supplémentaire : empêche un attaquant qui aurait volé une session
 * de changer le mdp sans connaître l'ancien).
 */
export function ChangerMdpForm() {
  const [pending, startTransition] = useTransition();

  const form = useForm<ChangerMonMotPasseInput>({
    resolver: zodResolver(changerMonMotPasseSchema),
    defaultValues: { motPasseActuel: '', nouveauMotPasse: '', confirmation: '' },
  });

  const onSubmit = (values: ChangerMonMotPasseInput) => {
    startTransition(async () => {
      const result = await changerMonMotPasse(values);
      if (result.status === 'succes') {
        toast.success('Mot de passe modifié');
        form.reset();
      } else if (result.status === 'erreur_mdp_actuel') {
        form.setError('motPasseActuel', { message: result.message });
        toast.error(result.message);
      } else if (result.status === 'erreur_validation') {
        for (const issue of result.issues) {
          form.setError(issue.path as 'motPasseActuel' | 'nouveauMotPasse' | 'confirmation', {
            message: issue.message,
          });
        }
        toast.error(`${result.issues.length} erreur(s) de validation`);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modifier mon mot de passe</CardTitle>
        <CardDescription>
          Politique : 8 caractères minimum, dont au moins une majuscule et un chiffre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="motPasseActuel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe actuel</FormLabel>
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
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Différent de l’actuel. Conseil : phrase mémorisable type{' '}
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
                  <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
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
            <Button type="submit" disabled={pending} className="gap-2">
              <KeyRound aria-hidden className="size-4" />
              {pending ? 'Modification…' : 'Modifier mon mot de passe'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
