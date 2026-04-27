import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/auth';

/**
 * Page racine `/` :
 *   - utilisateur authentifié → /dashboard
 *   - sinon → /accueil (vitrine publique institutionnelle, V1.4.0)
 *
 * La route /accueil est conservée comme URL canonique de la vitrine pour
 * permettre les liens externes (« visitez https://suivi-projet.org/accueil »)
 * tout en gardant la racine `/` comme aiguillage.
 */
export default async function Page() {
  const user = await getAuthUser();
  if (user) redirect('/dashboard');
  redirect('/accueil');
}
