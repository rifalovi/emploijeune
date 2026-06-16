/**
 * Configuration du tableau croisé dynamique (TCD) — indicateurs A1 et B1.
 * Module pur (importable côté client) : définit les dimensions, les mesures et
 * les types de données issues des cubes d'agrégation (RPC cube_*_v1).
 */

export type SourceTCD = 'A1' | 'B1';

/** Une ligne du cube : dimensions (string) + agrégats numériques. */
export type CubeRow = Record<string, string | number>;

export type ChampDef = {
  /** Clé dans la ligne de cube (ex. 'projet'). */
  cle: string;
  label: string;
};

export type MesureDef = {
  cle: string;
  label: string;
  /** 'count' = somme du décompte `n` ; 'sum' = somme du champ `champ`. */
  type: 'count' | 'sum';
  champ?: string;
  format: 'nombre' | 'montant';
};

export type SourceConfig = {
  code: SourceTCD;
  label: string;
  /** Dimensions disponibles (glissables). */
  champs: ChampDef[];
  mesures: MesureDef[];
};

export const SOURCES_TCD: Record<SourceTCD, SourceConfig> = {
  A1: {
    code: 'A1',
    label: 'Bénéficiaires (A1)',
    champs: [
      { cle: 'sexe', label: 'Sexe' },
      { cle: 'projet', label: 'Projet' },
      { cle: 'pays', label: 'Pays' },
      { cle: 'domaine', label: 'Domaine de formation' },
      { cle: 'annee', label: 'Année' },
      { cle: 'tranche', label: "Tranche d'âge" },
      { cle: 'statut', label: 'Statut' },
    ],
    mesures: [{ cle: 'nombre', label: 'Nombre de bénéficiaires', type: 'count', format: 'nombre' }],
  },
  B1: {
    code: 'B1',
    label: 'Structures (B1)',
    champs: [
      { cle: 'projet', label: 'Projet' },
      { cle: 'pays', label: 'Pays' },
      { cle: 'type', label: 'Type de structure' },
      { cle: 'secteur', label: "Secteur d'activité" },
      { cle: 'statut', label: 'Statut création' },
      { cle: 'annee', label: 'Année' },
      { cle: 'nature', label: "Nature d'appui" },
      { cle: 'porteur', label: 'Porteur' },
    ],
    mesures: [
      { cle: 'nombre', label: 'Nombre de structures', type: 'count', format: 'nombre' },
      { cle: 'emplois', label: 'Emplois créés', type: 'sum', champ: 'emplois', format: 'nombre' },
      {
        cle: 'montant',
        label: "Montant d'appui",
        type: 'sum',
        champ: 'montant',
        format: 'montant',
      },
    ],
  },
};
