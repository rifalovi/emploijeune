'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  creerCompteUtilisateurSchema,
  ROLES_CREABLES,
  ROLE_CREABLE_LIBELLES,
  type CreerCompteUtilisateurInput,
} from '@/lib/schemas/utilisateur';
import { creerCompteUtilisateur } from '@/lib/utilisateurs/mutations';
import { cn } from '@/lib/utils';

export type DialogueCreerUtilisateurProps = {
  organisations: Array<{ id: string; nom: string }>;
  projets: Array<{ code: string; libelle: string }>;
};

export function DialogueCreerUtilisateur({
  organisations,
  projets,
}: DialogueCreerUtilisateurProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreerCompteUtilisateurInput>({
    resolver: zodResolver(creerCompteUtilisateurSchema),
    defaultValues: {
      email: '',
      prenom: '',
      nom: '',
      role: 'editeur_projet',
      organisation_id: undefined,
      projets_geres: [],
    },
  });

  const role = form.watch('role');

  const onSubmit = (values: CreerCompteUtilisateurInput) => {
    startTransition(async () => {
      const result = await creerCompteUtilisateur(values);
      if (result.status === 'succes') {
        toast.success('Compte créé avec succès', {
          description:
            result.emailEnvoi === 'mock'
              ? `MOCK — Lien d'activation à transmettre manuellement : ${result.lienActivation}`
              : `Email d'activation envoyé à ${result.email}.`,
          duration: 15000,
        });
        form.reset();
        setOpen(false);
        router.refresh();
      } else if (result.status === 'erreur_validation') {
        for (const issue of result.issues) {
          form.setError(
            issue.path as 'email' | 'prenom' | 'nom' | 'role' | 'organisation_id' | 'projets_geres',
            {
              message: issue.message,
            },
          );
        }
        toast.error(`${result.issues.length} erreur(s) de validation`);
      } else if (result.status === 'erreur_doublon_email') {
        form.setError('email', { message: result.message });
        toast.error(result.message);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}>
        <UserPlus aria-hidden className="size-4" />
        Créer un compte
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un compte utilisateur</DialogTitle>
          <DialogDescription>
            Un email d’activation sera envoyé. Le destinataire devra définir son mot de passe au
            premier accès.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email professionnel *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
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
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // Réinitialise les rattachements quand on change de rôle
                      form.setValue('organisation_id', undefined);
                      form.setValue('projets_geres', []);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? (ROLE_CREABLE_LIBELLES[v as keyof typeof ROLE_CREABLE_LIBELLES] ?? v)
                            : ''
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_CREABLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_CREABLE_LIBELLES[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'contributeur_partenaire' && (
              <FormField
                control={form.control}
                name="organisation_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation / Structure *</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une organisation">
                          {(v: string | null) => {
                            if (!v) return 'Sélectionner une organisation';
                            const o = organisations.find((x) => x.id === v);
                            return o?.nom ?? v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {organisations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      L’utilisateur ne verra que les bénéficiaires/structures rattachés à cette
                      organisation.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {role === 'editeur_projet' && (
              <FormField
                control={form.control}
                name="projets_geres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet(s) géré(s) *</FormLabel>
                    <FormDescription>
                      Cochez les projets dont l’utilisateur est coordonnateur. (Pour gérer finement
                      le rattachement organisation-projet, créez d’abord l’organisation depuis
                      Supabase puis sélectionnez le contributeur.)
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
                      {projets.map((p) => {
                        const checked = (field.value ?? []).includes(p.code);
                        return (
                          <label
                            key={p.code}
                            className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const current = field.value ?? [];
                                field.onChange(
                                  e.target.checked
                                    ? [...current, p.code]
                                    : current.filter((c) => c !== p.code),
                                );
                              }}
                            />
                            <span className="font-mono">{p.code}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Création…' : 'Créer le compte'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
