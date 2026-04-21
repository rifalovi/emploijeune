import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cn } from '@/lib/utils';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={cn(geistSans.variable, geistMono.variable, 'font-sans antialiased')}>
        {children}
      </body>
    </html>
  );
}
