import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import './globals.css';

/**
 * Inter — substitut web de Helvetica Neue (police officielle OIF selon la
 * charte graphique page 9). Licence OFL, optimisée écran. Sur macOS/iOS,
 * le fallback CSS pointe vers Helvetica Neue si installée système.
 * Voir `lib/design/oif/typography.ts` pour le rationale complet.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '900'],
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'OIF — Suivi Emploi Jeunes',
  description:
    "Plateforme de gestion et de suivi des données du Service de Conception et Suivi de projet de l'OIF — thématique emploi des jeunes.",
  // Non-indexation en phase dev/pilote. À lever en production officielle une fois
  // le domaine et le contenu public validés.
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={cn(inter.variable, geistMono.variable, 'font-sans antialiased')}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
