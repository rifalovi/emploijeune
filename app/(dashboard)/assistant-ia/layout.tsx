import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Layout du segment /assistant-ia/* — V2.0.0.
 *
 * GATING STRICT : si le module `assistant_ia` n'est pas activé pour le rôle
 * de l'utilisateur courant, la page renvoie 404 — comme si elle n'existait
 * pas. Aucune indication que le module pourrait exister pour d'autres rôles.
 *
 * Cette logique est cohérente avec :
 *   - La sidebar qui n'affiche pas l'item « Assistant IA » dans ce cas
 *   - Le brief Carlos : « Pas d'item sidebar, pas de bouton, pas de mention »
 *   - La RPC `module_ia_actif_pour_courant` qui retourne FALSE
 */
export default async function AssistantIaLayout({ children }: { children: React.ReactNode }) {
  await requireUtilisateurValide();

  const supabase = await createSupabaseServerClient();
  const { data: actif } = await supabase.rpc('module_ia_actif_pour_courant');
  if (!actif) notFound();

  return <div className="space-y-6">{children}</div>;
}
