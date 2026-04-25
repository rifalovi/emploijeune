'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { demanderResetSchema, type DemanderResetInput } from '@/lib/schemas/auth';

/**
 * Demande de reset du mot de passe (Étape 6.5a).
 *
 * Sécurité : on retourne TOUJOURS un succès apparent même si l'email
 * n'existe pas dans Supabase Auth — évite l'énumération de comptes.
 * (Supabase signOut + resetPasswordForEmail ne révèle pas l'existence.)
 */
export function MotPasseOublieForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<DemanderResetInput>({
    resolver: zodResolver(demanderResetSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: DemanderResetInput) => {
    const supabase = createSupabaseBrowserClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${origin}/api/auth/callback?redirect=/motpasse/changer%3Freset%3D1`,
    });

    if (error) {
      toast.error("Impossible d'envoyer l'email", { description: error.message });
      return;
    }

    setSent(true);
    toast.success('Si cette adresse est connue, un email vient d’être envoyé.');
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email envoyé</CardTitle>
          <CardDescription>
            Si l’adresse <strong>{form.getValues('email')}</strong> correspond à un compte existant,
            vous recevrez un email contenant un lien pour réinitialiser votre mot de passe. Vérifiez
            aussi vos courriers indésirables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Recommencer avec une autre adresse
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réinitialiser mon mot de passe</CardTitle>
        <CardDescription>
          Saisissez l’adresse email associée à votre compte plateforme.
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
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Envoi en cours…' : 'Envoyer le lien'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
