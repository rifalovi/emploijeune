'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Bouton d'export Excel de la liste filtrée.
 *
 * Comportement :
 *   1. Lit les filtres courants depuis l'URL (useSearchParams)
 *   2. Fait un fetch GET sur /api/beneficiaires/export?<mêmes filtres>
 *   3. Transforme la réponse en Blob, crée une URL objet, déclenche le
 *      téléchargement via un <a download> programmatique
 *   4. Toast vert avec le nombre de lignes exportées (lu depuis
 *      l'en-tête X-Beneficiaires-Count)
 *
 * Désactivé si `totalDisponible === 0` (aucune ligne ne matche les filtres).
 */

export type BoutonExporterProps = {
  totalDisponible: number;
};

export function BoutonExporter({ totalDisponible }: BoutonExporterProps) {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const qs = searchParams.toString();
      const url = qs ? `/api/beneficiaires/export?${qs}` : '/api/beneficiaires/export';
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message || `Erreur ${response.status}`);
      }

      const count = Number(response.headers.get('X-Beneficiaires-Count') ?? '0');
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'OIF_Beneficiaires.xlsx';

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success(
        `${count.toLocaleString('fr-FR')} bénéficiaire${count > 1 ? 's' : ''} exporté${count > 1 ? 's' : ''}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Export impossible : ' + message);
    } finally {
      setIsPending(false);
    }
  };

  const disabled = isPending || totalDisponible === 0;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled}
      title="Exporte tous les bénéficiaires correspondant aux filtres actuels"
      aria-label={`Exporter ${totalDisponible} bénéficiaires vers Excel`}
    >
      {isPending ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden className="size-4" />
      )}
      {isPending ? 'Export en cours…' : 'Exporter vers Excel'}
    </Button>
  );
}
