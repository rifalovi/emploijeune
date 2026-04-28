'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { toggleModulePourRole } from '@/lib/super-admin/server-actions';
import type { RoleUtilisateur } from '@/lib/supabase/auth';

type Props = {
  role: RoleUtilisateur;
  libelle: string;
  description: string;
  active: boolean;
  disabled?: boolean;
};

export function ToggleModuleRow({ role, libelle, description, active, disabled }: Props) {
  const [actif, setActif] = useState(active);
  const [pending, startTransition] = useTransition();

  const onToggle = (next: boolean) => {
    if (disabled) return;
    const previous = actif;
    setActif(next); // optimistic

    startTransition(async () => {
      const res = await toggleModulePourRole({
        module: 'assistant_ia',
        role_cible: role,
        active: next,
      });

      if (res.status === 'erreur') {
        setActif(previous);
        toast.error(`Échec de l'activation : ${res.message}`);
        return;
      }
      toast.success(
        next
          ? `Assistant IA activé pour le rôle « ${libelle} »`
          : `Assistant IA désactivé pour le rôle « ${libelle} »`,
      );
    });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{libelle}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      </div>
      <Switch
        checked={actif}
        onCheckedChange={onToggle}
        disabled={disabled || pending}
        aria-label={`Activer le module Assistant IA pour le rôle ${libelle}`}
      />
    </div>
  );
}
