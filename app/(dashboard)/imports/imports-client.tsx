'use client';

import { ZoneUploadImport } from '@/components/imports/zone-upload-import';

type Props = {
  /** Module Import IA activé pour le rôle de l'utilisateur courant. */
  importIaActif: boolean;
};

/**
 * Wrapper client de la page imports — deux zones d'upload (bénéficiaires A1 et
 * structures B1). Chaque zone gère elle-même l'affichage de son rapport
 * d'import (dialogue) ainsi que le bouton « Importer quand même » pour forcer
 * l'insertion des doublons identifiés.
 *
 * Si `importIaActif` est true, les zones reçoivent aussi l'endpoint IA et
 * acceptent les PDF/DOCX/TXT (toggle « Analyser avec IA »). Sinon les formats
 * restent .xlsx/.csv uniquement.
 */
export function ImportsPageClient({ importIaActif }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ZoneUploadImport
        endpoint="/api/imports/beneficiaires"
        endpointIA="/api/imports/beneficiaires-ia"
        iaDispo={importIaActif}
        titre="Importer des bénéficiaires (A1)"
        description="Pipeline tolérant : noms de colonnes flexibles (Projet / Code projet / Projet *), codes abrégés acceptés (P14, P16a…), pays en libellé ou ISO-3. Rapport détaillé par statut (insérée / enrichie / incomplète / doublon / rejetée)."
        templateLabel="Modèle"
      />
      <ZoneUploadImport
        endpoint="/api/imports/structures"
        endpointIA="/api/imports/structures-ia"
        iaDispo={importIaActif}
        titre="Importer des structures (B1)"
        description="Format attendu : Template – feuille « Structures B1 » avec les 37 colonnes du modèle (Code projet, Nom structure, Type, Secteur, Porteur, etc.). Avec l'IA, importez aussi depuis des rapports PDF, Word ou texte."
        templateLabel="Modèle"
      />
    </div>
  );
}
