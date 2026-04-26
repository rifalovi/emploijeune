'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

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
import { envoyerResetMotPasse } from '@/lib/auth/envoyer-reset-mot-passe';

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

  // Refacto hotfix 6.5h-quinquies : appel Server Action `envoyerResetMotPasse`
  // qui génère le lien via admin.generateLink (sans envoi auto Supabase) puis
  // envoie via Resend avec template OIF français + footer RGPD. Politique
  // « ne pas révéler l'existence du compte » conservée (succès neutre).
  const onSubmit = async (values: DemanderResetInput) => {
    const result = await envoyerResetMotPasse(values);

    if (result.status === 'erreur_validation') {
      toast.error('Adresse invalide', { description: result.message });
      return;
    }
    if (result.status === 'erreur_inconnue') {
      toast.error("Impossible d'envoyer l'email", { description: result.message });
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
