import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/auth';

export default async function Page() {
  const user = await getAuthUser();
  if (user) redirect('/dashboard');
  redirect('/connexion');
}
