'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save, AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  modifierUtilisateurSchema,
  rolesAttribuables,
  ROLE_MODIFIABLE_LIBELLES,
  type ModifierUtilisateurInput,
  type RoleModifiable,
} from '@/lib/schemas/utilisateur-modifier';
import { modifierUtilisateur } from '@/lib/utilisateurs/modifier';
import { cn } from '@/lib/utils';

export type FormulaireModifierUtilisateurProps = {
  utilisateurId: string;
  initialValues: {
    nom_complet: string;
    role: string;
    organisation_id: string | null;
    actif: boolean;
  };
  organisations: Array<{ id: string; nom: string; projets_geres: string[] }>;
  estLuiMeme: boolean;
  /** Rôle de l'utilisateur courant : sert à filtrer les rôles attribuables. v2.0.1. */
  roleCourant: string;
};

export function FormulaireModifierUtilisateur({
  utilisateurId,
  initialValues,
  organisations,
  estLuiMeme,
  roleCourant,
}: FormulaireModifierUtilisateurProps) {
  // Hiérarchie : un rôle ne peut JAMAIS modifier vers un compte de
  // même niveau ou supérieur (cf. lib/schemas/utilisateur-modifier).
  // On inclut toujours le rôle initial dans la liste pour éviter de le
  // perdre s'il est hors hiérarchie (ex. admin_scs modifie un super_admin
  // existant — cas théorique).
  const rolesDisponibles: RoleModifiable[] = (() => {
    const base = rolesAttribuables(roleCourant);
    const initial = initialValues.role as RoleModifiable;
    if (initial && !base.includes(initial)) {
      return [...base, initial];
    }
    return base;
  })();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmRoleOuvert, setConfirmRoleOuvert] = useState(false);

  const form = useForm<ModifierUtilisateurInput>({
    resolver: zodResolver(modifierUtilisateurSchema),
    defaultValues: {
      utilisateurId,
      nom_complet: initialValues.nom_complet,
      role: initialValues.role,
      organisation_id: initialValues.organisation_id ?? undefined,
      actif: initialValues.actif,
      raison_changement: '',
    },
  });

  const role = form.watch('role');
  const orgaId = form.watch('organisation_id');
  const actif = form.watch('actif');

  const orgaSelectionnee = organisations.find((o) => o.id === orgaId);

  const handleSubmit = (values: ModifierUtilisateurInput) => {
    // Si changement de rôle : ouvrir confirmation
    if (values.role !== initialValues.role && !confirmRoleOuvert) {
      setConfirmRoleOuvert(true);
      return;
    }
    setConfirmRoleOuvert(false);
    soumettre(values);
  };

  const soumettre = (values: ModifierUtilisateurInput) => {
    startTransition(async () => {
      const result = await modifierUtilisateur(values);
      if (result.status === 'succes') {
        if (result.champsModifies.length === 0) {
          toast.info('Aucune modification détectée');
        } else {
          toast.success(`${result.champsModifies.length} champ(s) modifié(s)`, {
            description: result.champsModifies.join(', '),
          });
        }
        router.push('/admin/utilisateurs');
        router.refresh();
      } else if (result.status === 'erreur_validation') {
        for (const issue of result.issues) {
          form.setError(issue.path as keyof ModifierUtilisateurInput, { message: issue.message });
        }
        toast.error(`${result.issues.length} erreur(s) de validation`);
      } else if ('message' in result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Card 1 : Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="nom_complet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Card 2 : Rôle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Rôle</CardTitle>
            {estLuiMeme && (
              <CardDescription className="text-amber-700 dark:text-amber-400">
                Vous ne pouvez pas modifier votre propre rôle.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle attribué *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={estLuiMeme}>
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? (ROLE_MODIFIABLE_LIBELLES[
                                v as keyof typeof ROLE_MODIFIABLE_LIBELLES
                              ] ?? v)
                            : ''
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {rolesDisponibles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_MODIFIABLE_LIBELLES[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Le changement de rôle impactera immédiatement les permissions et l’accès aux
                    données (RLS).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Card 3 : Rattachement organisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Rattachement organisation</CardTitle>
            {role === 'admin_scs' && (
              <CardDescription>
                Les administrateurs SCS ont accès à tous les projets et structures — le rattachement
                organisation est facultatif.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="organisation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Organisation
                    {role === 'contributeur_partenaire' && ' *'}
                  </FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune">
                        {(v: string | null) => {
                          if (!v) return 'Aucune';
                          const o = organisations.find((x) => x.id === v);
                          return o?.nom ?? v;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune</SelectItem>
                      {organisations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {orgaSelectionnee && orgaSelectionnee.projets_geres.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                  Projets gérés par cette organisation
                </p>
                <div className="flex flex-wrap gap-1">
                  {orgaSelectionnee.projets_geres.map((p) => (
                    <Badge key={p} variant="secondary" className="font-mono text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground mt-2 text-xs italic">
                  L’édition des projets gérés se fait depuis la page admin des organisations (V1.5).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4 : Statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Statut du compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="actif"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <input
                      type="checkbox"
                      id="actif"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      disabled={estLuiMeme && initialValues.actif && !field.value}
                      className="mt-0.5"
                    />
                    <Label htmlFor="actif" className="text-sm leading-snug">
                      Compte actif (l’utilisateur peut se connecter et accéder à la plateforme)
                    </Label>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!actif && initialValues.actif && (
              <FormField
                control={form.control}
                name="raison_changement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raison de la désactivation (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        maxLength={500}
                        placeholder="Ex. départ de l’organisation, fin de mission OIF…"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Cette raison est tracée dans le journal d’audit. La session active de
                      l’utilisateur sera invalidée immédiatement.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/utilisateurs')}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={pending} className="gap-2">
            <Save aria-hidden className="size-4" />
            {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </Button>
        </div>

        {/* AlertDialog confirmation changement de rôle */}
        <AlertDialog open={confirmRoleOuvert} onOpenChange={setConfirmRoleOuvert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" aria-hidden />
                Confirmer le changement de rôle
              </AlertDialogTitle>
              <AlertDialogDescription>
                Vous allez modifier le rôle de cet utilisateur de{' '}
                <strong>
                  {ROLE_MODIFIABLE_LIBELLES[
                    initialValues.role as keyof typeof ROLE_MODIFIABLE_LIBELLES
                  ] ?? initialValues.role}
                </strong>{' '}
                vers{' '}
                <strong>
                  {ROLE_MODIFIABLE_LIBELLES[role as keyof typeof ROLE_MODIFIABLE_LIBELLES] ?? role}
                </strong>
                . Les permissions et l’accès aux données (RLS) seront impactés immédiatement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
              <button
                type="button"
                onClick={() => soumettre(form.getValues())}
                disabled={pending}
                className={cn(buttonVariants({ variant: 'default' }), 'gap-1')}
              >
                Confirmer le changement
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </Form>
  );
}
