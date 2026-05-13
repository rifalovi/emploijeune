import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { Toaster } from '@/components/ui/sonner';
import { ChatbotScs } from '@/components/chatbot-scs/chatbot-scs';
import { cn } from '@/lib/utils';
import { getBaseUrl } from '@/lib/utils/base-url';
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
  // metadataBase : résout les URLs relatives (images OG/Twitter) en URLs
  // absolues. Utilise getBaseUrl() qui gère VERCEL_URL en prod et le
  // garde-fou anti-localhost.
  metadataBase: new URL(getBaseUrl()),
  title: 'OIF – Suivi Emploi Jeunes',
  description:
    "Plateforme de gestion et de suivi des données du Service de Conception et Suivi de projet de l'OIF – thématique emploi des jeunes.",
  // Non-indexation en phase dev/pilote. À lever en production officielle une fois
  // le domaine et le contenu public validés.
  robots: {
    index: false,
    follow: false,
  },
  // Open Graph + Twitter Card — aperçu enrichi sur WhatsApp, LinkedIn,
  // Facebook, Twitter/X. Les images sont auto-détectées par Next.js
  // depuis app/opengraph-image.png et app/twitter-image.png (1200x630,
  // logo OIF sur fond bleu institutionnel #0E4F88).
  openGraph: {
    title: 'OIF – Suivi Emploi Jeunes',
    description:
      "Plateforme de gestion et de suivi des projets emploi-jeunes de l'Organisation Internationale de la Francophonie.",
    type: 'website',
    locale: 'fr_FR',
    siteName: 'OIF Emploi Jeunes',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OIF – Suivi Emploi Jeunes',
    description:
      "Plateforme de gestion et de suivi des projets emploi-jeunes de l'OIF.",
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
        <ChatbotScs />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
