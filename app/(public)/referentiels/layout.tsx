import { getAuthUser } from '@/lib/supabase/auth';
import { HeaderPublic } from '@/components/landing/header-public';
import { SidebarReferentiels } from '@/components/referentiels/sidebar-referentiels';

/**
 * Layout du segment /referentiels/* — V2.4.0.
 *
 * Header public 4 onglets + sidebar sticky 5 piliers + contenu principal.
 * Footer minimaliste partagé avec la vitrine.
 */
export default async function ReferentielsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={isAuthenticated} />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[260px_1fr]">
        <SidebarReferentiels />
        <main className="min-w-0">{children}</main>
      </div>
      <FooterMinimaliste />
    </div>
  );
}

function FooterMinimaliste() {
  return (
    <footer className="border-t bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-8">
        <p>
          © {new Date().getFullYear()} OIF · Service de Conception et Suivi · Référentiel basé sur
          le Cadre Commun de mesure du rendement V2.
        </p>
      </div>
    </footer>
  );
}
