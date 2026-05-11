'use client';

import { useState } from 'react';
import { ZoneUploadImport } from '@/components/imports/zone-upload-import';
import { DialogueRapportImport } from '@/components/imports/dialogue-rapport-import';
import { DialogueRapportImportEnrichi } from '@/components/imports/dialogue-rapport-import-enrichi';
import type { RapportImport, RapportImportEnrichi } from '@/lib/imports/types';

/**
 * Wrapper client de la page imports — gère 2 états distincts :
 *   - rapportClassique  : pour les structures B1 (ancien pipeline)
 *   - rapportEnrichi    : pour les bénéficiaires A1 (nouveau pipeline
 *     tolérant avec 5 statuts et mappages auto)
 *
 * Le `ZoneUploadImport` accepte les deux types via union — on distingue
 * en sortie par la présence du champ `nb_inserees` (spécifique au type
 * enrichi).
 */
export function ImportsPageClient() {
  const [rapportClassique, setRapportClassique] = useState<RapportImport | null>(null);
  const [rapportEnrichi, setRapportEnrichi] = useState<RapportImportEnrichi | null>(null);

  const handleRapport = (
    setEnrichi: typeof setRapportEnrichi,
    setClassique: typeof setRapportClassique,
  ) => (r: RapportImport | RapportImportEnrichi) => {
    if ('nb_inserees' in r) setEnrichi(r);
    else setClassique(r);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ZoneUploadImport
          endpoint="/api/imports/beneficiaires"
          titre="Importer des bénéficiaires (A1)"
          description="Pipeline tolérant : noms de colonnes flexibles (Projet / Code projet / Projet *), codes abrégés acceptés (P14, P16a…), pays en libellé ou ISO-3. Rapport détaillé par statut (insérée / enrichie / incomplète / doublon / rejetée)."
          templateLabel="Modèle"
          onRapport={handleRapport(setRapportEnrichi, setRapportClassique)}
        />
        <ZoneUploadImport
          endpoint="/api/imports/structures"
          titre="Importer des structures (B1)"
          description="Format attendu : Template – feuille « Structures B1 » avec les 37 colonnes du modèle (Code projet, Nom structure, Type, Secteur, Porteur, etc.)."
          templateLabel="Modèle"
          onRapport={handleRapport(setRapportEnrichi, setRapportClassique)}
        />
      </div>

      <DialogueRapportImport
        rapport={rapportClassique}
        onClose={() => setRapportClassique(null)}
      />
      <DialogueRapportImportEnrichi
        rapport={rapportEnrichi}
        onClose={() => setRapportEnrichi(null)}
      />
    </>
  );
}
