'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse courriel invalide'),
});

type FormValues = z.infer<typeof schema>;

export function ConnexionForm() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    const supabase = createSupabaseBrowserClient();
    const redirect = searchParams.get('redirect') ?? '/dashboard';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/api/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });

    if (error) {
      toast.error("Impossible d'envoyer le lien", {
        description: error.message,
      });
      return;
    }

    setSent(true);
    toast.success('Lien envoyé', {
      description: 'Consultez votre boîte mail (et vos indésirables).',
    });
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien envoyé</CardTitle>
          <CardDescription>
            Un lien de connexion vient d'être envoyé à <strong>{form.getValues('email')}</strong>.
            Il est valable <strong>1 heure</strong>. Pensez à vérifier vos courriers indésirables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Changer d'adresse
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Se connecter</CardTitle>
        <CardDescription>
          Recevez un lien de connexion unique par courriel. Pas de mot de passe à retenir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message === 'compte_refuse' && (
          <div className="border-destructive/50 bg-destructive/5 text-destructive mb-4 rounded-md border p-3 text-sm">
            Votre accès à la plateforme a été refusé. Pour contester cette décision, contactez le
            SCS.
          </div>
        )}
        {message === 'compte_inactif' && (
          <div className="border-destructive/50 bg-destructive/5 text-destructive mb-4 rounded-md border p-3 text-sm">
            Votre compte est désactivé. Contactez le SCS.
          </div>
        )}
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
                    Utilisez l'adresse que le SCS ou votre unité chef de file connaît.
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
      </CardContent>
    </Card>
  );
}
