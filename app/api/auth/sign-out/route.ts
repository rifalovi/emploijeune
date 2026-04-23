import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Déconnexion : invalide la session Supabase côté serveur et supprime
 * les cookies. Accepte GET et POST pour compatibilité avec les deux
 * patterns (form POST pour confirmation explicite, GET pour liens directs).
 */
async function signOut(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/connexion?message=deconnexion`, {
    status: 303, // force GET sur la redirection après POST
  });
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}
