'use client';

import { useState } from 'react';
import { ZoneUploadImport } from '@/components/imports/zone-upload-import';
import { DialogueRapportImport } from '@/components/imports/dialogue-rapport-import';
import type { RapportImport } from '@/lib/imports/types';

/**
 * Wrapper client de la page imports — gère l'état du rapport modal
 * partagé entre les 2 zones d'upload (bénéficiaires / structures).
 */
export function ImportsPageClient() {
  const [rapport, setRapport] = useState<RapportImport | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoneUploadImport
          endpoint="/api/imports/beneficiaires"
          titre="Importer des bénéficiaires (A1)"
          description="Format attendu : Template V1 — feuille « Bénéficiaires » avec les 22 colonnes du modèle (Code projet, Code pays, Prénom, Nom, Sexe, etc.)."
          templateLabel="Modèle"
          onRapport={setRapport}
        />
        <ZoneUploadImport
          endpoint="/api/imports/structures"
          titre="Importer des structures (B1)"
          description="Format attendu : Template V1 — feuille « Structures B1 » avec les 37 colonnes du modèle (Code projet, Nom structure, Type, Secteur, Porteur, etc.)."
          templateLabel="Modèle"
          onRapport={setRapport}
        />
      </div>

      <DialogueRapportImport rapport={rapport} onClose={() => setRapport(null)} />
    </>
  );
}
