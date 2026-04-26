'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send, CheckCircle2 } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  creerDemandeAccesSchema,
  ROLES_DEMANDABLES,
  ROLE_DEMANDABLE_LIBELLES,
  type CreerDemandeAccesInput,
} from '@/lib/schemas/demande-acces';
import { creerDemandeAcces } from '@/lib/demandes-acces/mutations';

/**
 * Formulaire public de demande d'accès (V1-Enrichie-A).
 *
 * Le composant gère 2 états :
 *   - saisie : formulaire complet
 *   - envoyée : écran de confirmation (avec espoir réaliste sur le délai
 *     de traitement par le SCS)
 */
export function DemandeAccesForm() {
  const [pending, startTransition] = useTransition();
  const [envoyee, setEnvoyee] = useState(false);

  const form = useForm<CreerDemandeAccesInput>({
    resolver: zodResolver(creerDemandeAccesSchema),
    defaultValues: {
      email: '',
      prenom: '',
      nom: '',
      role_souhaite: 'editeur_projet',
      contexte_souhaite: '',
      justification: '',
      consentement_rgpd: false,
    },
  });

  const role = form.watch('role_souhaite');

  const onSubmit = (values: CreerDemandeAccesInput) => {
    startTransition(async () => {
      const result = await creerDemandeAcces(values);
      if (result.status === 'succes') {
        setEnvoyee(true);
        toast.success('Demande envoyée');
      } else if (result.status === 'erreur_doublon') {
        toast.error('Demande non enregistrée', { description: result.message });
      } else if (result.status === 'erreur_validation') {
        for (const issue of result.issues) {
          form.setError(
            issue.path as
              | 'email'
              | 'prenom'
              | 'nom'
              | 'role_souhaite'
              | 'contexte_souhaite'
              | 'justification'
              | 'consentement_rgpd',
            { message: issue.message },
          );
        }
        toast.error(`${result.issues.length} erreur(s) de validation`);
      } else {
        toast.error(result.message);
      }
    });
  };

  if (envoyee) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 aria-hidden className="size-12 text-green-600" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Demande envoyée</h2>
            <p className="text-muted-foreground text-sm">
              Votre demande a été enregistrée. Le Service de Conception et Suivi (SCS) l’examinera
              dans les meilleurs délais.
            </p>
            <p className="text-muted-foreground text-sm">
              Un email de confirmation vient de vous être envoyé. Vous serez prévenu(e) dès qu’une
              décision aura été prise.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demander l’accès à la plateforme</CardTitle>
        <CardDescription>
          La plateforme OIF Emploi Jeunes est destinée aux partenaires et coordonnateurs de projets
          validés par le Service de Conception et Suivi (SCS). Si vous êtes concerné(e), renseignez
          ce formulaire et le SCS étudiera votre demande.
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
                  <FormLabel>Adresse email professionnelle *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="prenom.nom@organisation.org"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom *</FormLabel>
                    <FormControl>
                      <Input autoComplete="given-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input autoComplete="family-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role_souhaite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle souhaité *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as 'editeur_projet' | 'contributeur_partenaire')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? (ROLE_DEMANDABLE_LIBELLES[
                                v as keyof typeof ROLE_DEMANDABLE_LIBELLES
                              ] ?? v)
                            : ''
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_DEMANDABLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_DEMANDABLE_LIBELLES[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contexte_souhaite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {role === 'editeur_projet'
                      ? 'Quel(s) projet(s) souhaitez-vous coordonner ?'
                      : 'Pour quelle structure / organisation ?'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      maxLength={500}
                      placeholder={
                        role === 'editeur_projet'
                          ? 'Ex. PROJ_A14, PROJ_A16a (séparer par virgules)'
                          : 'Ex. Association ABC, Coopérative XYZ'
                      }
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justification de votre demande *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      maxLength={1000}
                      placeholder="Décrivez votre rôle, vos responsabilités, et le contexte de votre demande d’accès."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Minimum 20 caractères. Cette information aide le SCS à prendre sa décision.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consentement_rgpd"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-2 rounded-md border p-3">
                    <input
                      type="checkbox"
                      id="consentement_rgpd"
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="mt-0.5"
                    />
                    <label htmlFor="consentement_rgpd" className="text-sm leading-snug">
                      J’accepte que mes données soient traitées par le Service de Conception et
                      Suivi (SCS) de l’OIF aux fins exclusives d’évaluation de cette demande
                      d’accès. Conservation : 90 jours en cas de rejet, durée de la relation en cas
                      d’approbation.
                    </label>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full gap-2" disabled={pending}>
              <Send aria-hidden className="size-4" />
              {pending ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
