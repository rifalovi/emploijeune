'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Bouton d'export Excel B1 de la liste filtrée des structures.
 *
 * Comportement (miroir de `BoutonExporter` bénéficiaires, 4e) :
 *   1. Lit les filtres courants depuis l'URL
 *   2. Fait un fetch GET sur /api/structures/export?<mêmes filtres>
 *   3. Transforme la réponse en Blob, déclenche le téléchargement
 *   4. Toast vert avec le nombre de structures exportées
 *
 * Désactivé si `totalDisponible === 0`.
 */

export type BoutonExporterStructuresProps = {
  totalDisponible: number;
};

export function BoutonExporterStructures({ totalDisponible }: BoutonExporterStructuresProps) {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    setIsPending(true);
    try {
      const qs = searchParams.toString();
      const url = qs ? `/api/structures/export?${qs}` : '/api/structures/export';
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message || `Erreur ${response.status}`);
      }

      const count = Number(response.headers.get('X-Structures-Count') ?? '0');
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'OIF_Structures.xlsx';

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
        `${count.toLocaleString('fr-FR')} structure${count > 1 ? 's' : ''} exportée${count > 1 ? 's' : ''}`,
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
      title="Exporte toutes les structures correspondant aux filtres actuels"
      aria-label={`Exporter ${totalDisponible} structures vers Excel`}
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
