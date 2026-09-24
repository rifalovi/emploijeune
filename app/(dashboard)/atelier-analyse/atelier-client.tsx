'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Database,
  Download,
  FileStack,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  FlaskConical,
  Gauge,
  Layers,
  Languages,
  ListChecks,
  ListOrdered,
  Loader2,
  Save,
  Search,
  ScrollText,
  Sigma,
  Sparkles,
  SquareDashed,
  Table2,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/ia/markdown-renderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { couleurRang, tooltipPropsPremium } from '@/lib/design/charts';

import {
  chargerDatasetEnqueteAction,
  chargerDatasetMultiProjetsAction,
  chargerDatasetBeneficiairesAction,
  chargerDatasetStructuresAction,
  chargerTraitementAction,
  enregistrerTraitementAction,
  viderHistoriqueAction,
  type TraitementDetail,
} from '@/lib/atelier-analyse/actions';
import {
  analyzeDataset,
  computeClean,
  computeConsolidate,
  computeConsolidationPlan,
  computeCrosstab,
  computeFrequency,
  computeList,
  computeModalities,
  computeMulti,
  computePreview,
  computeQuality,
  computeStatTest,
  computeTranslate,
  computeTranslationFreetext,
  computeTranslationTerms,
  ingestFile,
  uploadSpssFile,
  type ComputeSource,
} from '@/lib/atelier-analyse/api-client';
import {
  clarifierRapportAction,
  extraireModeleRapportAction,
  genererRapportAction,
} from '@/lib/atelier-analyse/rapport';
import { traduireTermesAction, traduireTextesLibresAction } from '@/lib/atelier-analyse/traduction';
import {
  exporterCrossExcel,
  exporterFreqExcel,
  exporterFreqTableExcel,
  exporterGlobalExcel,
  exporterListeExcel,
  exporterMultiExcel,
} from '@/lib/atelier-analyse/exports';
import {
  exporterFreqTableWord,
  exporterListeWord,
  exporterRapportWord,
  exporterResultatsWord,
} from '@/lib/atelier-analyse/word-export';
import { exporterRapportPdf } from '@/lib/atelier-analyse/pdf-export';
import { FORMATS_RAPPORT, OPERATEURS_FILTRE } from '@/lib/atelier-analyse/types';
import type {
  AnalyzeResponse,
  CleanResponse,
  ConsolidationPlanResponse,
  CrosstabResponse,
  DatasetInput,
  FilterCond,
  FormatRapport,
  FrequencyResponse,
  HistoriqueJob,
  IndicateurSource,
  MultiResponse,
  PreviewResponse,
  QualityResponse,
  StatTestResponse,
} from '@/lib/atelier-analyse/types';

const AUCUNE = '__aucune__';
// Taille de lot pour la traduction des réponses ouvertes (nb de réponses par
// appel IA). Défini ici (composant client) et non dans un fichier « use server »
// — un tel fichier ne peut exporter que des fonctions async.
const TAILLE_LOT_TEXTES = 60;

function pct(v: number | null): string {
  return v === null || v === undefined ? '' : `${(v * 100).toFixed(1)} %`;
}

/** Types de mesure du moteur, avec libellé court et teinte de badge. */
const MESURES: Record<string, { court: string; classe: string }> = {
  NOMINAL: { court: 'Nom.', classe: 'bg-sky-100 text-sky-800' },
  ORDINAL: { court: 'Ord.', classe: 'bg-violet-100 text-violet-800' },
  ÉCHELLE: { court: 'Éch.', classe: 'bg-emerald-100 text-emerald-800' },
};

// Motifs de variables « techniques » (identifiants, métadonnées d'entretien…)
// exclues de la présélection par défaut.
const MOTIFS_TECHNIQUES =
  /\b(id|ids|identifier|identifiant|uuid|guid|index|clé|cle|key|random|al[ée]atoire|interview|entretien|assignment|submission|instance|timestamp|status|statut|errors?\s*count|duration|dur[ée]e|d[ée]but|start|end|latitude|longitude|gps|geopoint|deviceid|version)\b/i;

/** Une variable est « technique » (peu pertinente pour un tri à plat direct). */
function estVariableTechnique(
  v: { name: string; display: string; cardinality: number },
  nRows: number,
): boolean {
  if (MOTIFS_TECHNIQUES.test(`${v.name} ${v.display}`)) return true;
  // Identifiant / texte libre : cardinalité quasi unique ou très élevée.
  if (v.cardinality > 100) return true;
  if (nRows > 0 && v.cardinality >= 0.9 * nRows) return true;
  return false;
}

/** Présélection intelligente : variables analysables, hors variables techniques. */
function preselectionIntelligente(
  variables: { name: string; display: string; cardinality: number }[],
  nRows: number,
): string[] {
  const retenues = variables.filter((v) => !estVariableTechnique(v, nRows)).map((v) => v.name);
  // Repli : si tout a été exclu, on garde les 20 premières pour ne pas bloquer.
  return retenues.length > 0 ? retenues : variables.slice(0, 20).map((v) => v.name);
}

// ------------------------------------------------------------------ Exports
/** Déclenche le téléchargement d'un fichier texte (CSV/Markdown) côté navigateur. */
function telechargerFichier(nom: string, contenu: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convertit des enregistrements en CSV (séparateur « ; », compatible Excel FR). */
function versCsv(rows: Record<string, unknown>[], colonnes?: string[]): string {
  if (rows.length === 0) return '';
  const cols = colonnes ?? Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
}

/** Nom de fichier sûr (accents/espaces/ponctuation remplacés). */
function nomSur(base: string): string {
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

// Guide en ligne adapté (repris de SCS DataStudio desktop, version web/IA).
const GUIDE_MD = `## Prise en main de l'Atelier d'analyse

L'Atelier reprend le moteur **SCS DataStudio** dans la plateforme, augmenté de l'IA. Le fichier source n'est jamais modifié : tous les calculs sont produits à la demande.

### 1. Choisir la source
- **Depuis une enquête** : sélectionnez un indicateur de la plateforme.
- **Importer un fichier** : SPSS (.sav), Excel (.xlsx/.xls), LibreOffice (.ods), CSV/TSV/TAB, JSON, tableau Word (.docx), exports Kobo/CSPro.

### 2. Explorer les données (section Données)
- **Caractéristiques** : type de mesure (Nominale / Ordinale / Échelle) et cardinalité de chaque variable.
- **Diagnostic** : vue d'ensemble du jeu de données (volume, types, variables techniques, batteries multi-réponses).
- **Nettoyage** : aperçu d'une base épurée (lignes vides, doublons).

### 3. Analyser (section Analyses)
- **Tris à plat** : effectifs, %, % valide, % cumulé — recherche et filtres par type, présélection intelligente.
- **Croisements** : tableaux croisés, couche/filtre, % ligne ou colonne.
- **Tests statistiques** : Khi² d'indépendance et t-test de Welch.
- **Réponses multiples** : batteries de questions 0/1.
- **Graphiques** : barres ou camembert d'une variable.

### 4. Restituer
- **Rapport** : l'IA rédige une note à partir des résultats produits (jamais de chiffres inventés).

### 5. Exporter
- **CSV** et **Excel** mis en forme par tableau, **Export global** (un classeur), **Word documenté**, **PDF** du rapport.

> Un signal détecté n'est pas une erreur confirmée : confrontez toujours au questionnaire et aux règles métier.`;

const METHODE_MD = `## Méthodologie, IA et limites

### Démarche reproductible
1. Conserver le fichier source sans le modifier.
2. Inventorier variables, libellés et types de mesure.
3. Détecter valeurs manquantes, doublons stricts et incohérences de type.
4. Épurer explicitement (transformations réversibles).
5. Analyser sur la base active et filtrée, puis restituer.
6. Valider humainement les règles métier avant diffusion.

### Part confiée à l'IA
L'IA aide à **rédiger** et **structurer** les rapports à partir des résultats calculés. Elle **ne décide pas seule** qu'une réponse est fausse, ne supprime personne, n'impute aucune valeur et ne transforme aucune catégorie métier. Les chiffres proviennent du moteur, pas du modèle.

### Limites
Un fichier lisible et un programme sans erreur ne prouvent pas l'exactitude des données. Les valeurs atypiques restent des signaux à vérifier. Pour les fichiers SPSS, les libellés de variables et de valeurs sont conservés.`;

type DocumentReference = { cle: string; libelle: string; nomFichier: string };
type Programme = { code: string; libelle: string };
type Projet = { code: string; libelle: string; programme: string };

/**
 * Descripteur de rechargement d'une base de travail. Une base transformée
 * (épurée, traduite) référence sa base d'origine via `base`, ce qui permet de
 * reconstruire la chaîne complète (ex. importer → traduire → épurer) en rouvrant
 * un traitement depuis l'historique.
 */
type ReloadDesc = {
  kind?: string;
  datasetRef?: string;
  nom?: string;
  indicateur?: string;
  projets?: string[];
  projet?: string | null;
  base?: ReloadDesc;
  // Traduction
  columnMap?: Record<string, string>;
  valueMaps?: Record<string, Record<string, string>>;
  freeTextColumns?: string[];
  name?: string;
  langueCible?: string;
  // Épuration
  normMissing?: boolean;
  trimEspaces?: boolean;
  arrondir?: boolean;
  dropEmpty?: boolean;
  dropDuplicates?: boolean;
  dropMissing?: boolean;
  keyCols?: string[];
  // Consolidation multilingue
  groups?: { canonical: string; members: string[] }[];
};

type Props = {
  indicateurs: IndicateurSource[];
  historique: { jobs: HistoriqueJob[]; erreur: string | null };
  documentsReference?: DocumentReference[];
  programmes?: Programme[];
  projets?: Projet[];
  estSuperAdmin?: boolean;
};

export function AtelierClient({
  indicateurs,
  historique,
  documentsReference = [],
  programmes = [],
  projets = [],
  estSuperAdmin = false,
}: Props) {
  const router = useRouter();
  const [ongletActif, setOngletActif] = useState('freq');
  const [sourceMode, setSourceMode] = useState<
    'enquete' | 'fichier' | 'multi' | 'beneficiaires' | 'structures'
  >('enquete');

  // Multi-projets (traitement mensuel, section à part)
  const [mpProgramme, setMpProgramme] = useState('__tous__');
  const [mpIndicateur, setMpIndicateur] = useState('');
  const [mpProjets, setMpProjets] = useState<string[]>([]);
  // Bases plateforme (bénéficiaires / structures) : filtre projet optionnel.
  const [bdProjet, setBdProjet] = useState('__tous__');
  const [indicateur, setIndicateur] = useState('');
  const [dataset, setDataset] = useState<DatasetInput | null>(null);
  const [datasetRef, setDatasetRef] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [fichierNom, setFichierNom] = useState('');
  // Import multi-feuilles : chemin Storage brut + feuilles disponibles + feuille
  // active, pour re-lire la BONNE feuille sans re-téléverser le fichier.
  const [fichierPath, setFichierPath] = useState<string | null>(null);
  const [feuilles, setFeuilles] = useState<string[]>([]);
  const [feuilleSel, setFeuilleSel] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyzeResponse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Tris à plat
  const [varsSel, setVarsSel] = useState<string[]>([]);
  const [exclure, setExclure] = useState(false);
  const [freq, setFreq] = useState<FrequencyResponse | null>(null);
  const [busyFreq, setBusyFreq] = useState(false);

  // Croisements
  const [row, setRow] = useState('');
  const [col, setCol] = useState('');
  const [layer, setLayer] = useState(AUCUNE);
  const [pctMode, setPctMode] = useState<'Ligne' | 'Colonne'>('Ligne');
  const [cross, setCross] = useState<CrosstabResponse | null>(null);
  const [busyCross, setBusyCross] = useState(false);

  // Tests statistiques (Khi² / Welch)
  const [statRow, setStatRow] = useState('');
  const [statCol, setStatCol] = useState('');
  const [stat, setStat] = useState<StatTestResponse | null>(null);
  const [busyStat, setBusyStat] = useState(false);

  // Réponses multiples (batteries 0/1)
  const [multi, setMulti] = useState<MultiResponse | null>(null);
  const [busyMulti, setBusyMulti] = useState(false);

  // Nettoyage / épuration de la base
  // ① Corrections (ne retirent aucune ligne)
  const [normMissing, setNormMissing] = useState(true);
  const [trimEspaces, setTrimEspaces] = useState(true);
  const [arrondir, setArrondir] = useState(true);
  // ② Épuration (retrait de lignes)
  const [dropEmpty, setDropEmpty] = useState(true);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  // Variables OBLIGATOIRES : une ligne est retirée si l'une d'elles est vide
  // (ex. nom, prénom, contact). Épuration ciblée plutôt qu'aveugle.
  const [keyCols, setKeyCols] = useState<string[]>([]);
  // Option agressive : ne garder que les lignes 100 % complètes (toute valeur
  // manquante, sur n'importe quelle variable, entraîne le retrait).
  const [dropMissing, setDropMissing] = useState(false);
  const [clean, setClean] = useState<CleanResponse | null>(null);
  const [busyClean, setBusyClean] = useState(false);
  // Vrai quand la base de travail active est la base ÉPURÉE (adoptée).
  const [baseEpuree, setBaseEpuree] = useState(false);
  // Descripteur de rechargement de la base épurée courante (pour que les
  // traitements enregistrés dessus rouvrent bien la base nettoyée, pas la brute).
  const [epureeReload, setEpureeReload] = useState<Record<string, unknown> | null>(null);

  // Traduction (IA) : base importée en langue étrangère ramenée en langue cible.
  const [langueCible, setLangueCible] = useState('Français');
  const [busyTrad, setBusyTrad] = useState(false);
  // Vrai quand la base de travail active est la base TRADUITE (adoptée).
  const [traduit, setTraduit] = useState(false);
  // Descripteur de rechargement de la base traduite (mêmes rôle que epureeReload).
  const [traduitReload, setTraduitReload] = useState<Record<string, unknown> | null>(null);
  // Récapitulatif de la dernière traduction (langue détectée + volumétrie).
  const [traductionInfo, setTraductionInfo] = useState<{
    langueDetectee: string;
    langueCible: string;
    nbColonnes: number;
    nbValeurs: number;
    nbOuvertes?: number;
  } | null>(null);
  // Réponses ouvertes (texte libre) détectées + sélection à traduire par lots.
  const [colonnesOuvertes, setColonnesOuvertes] = useState<string[]>([]);
  const [ouvertesSel, setOuvertesSel] = useState<Set<string>>(new Set());
  const [progressTrad, setProgressTrad] = useState<string>('');
  // Résultat de l'étape « détection » (réutilisé à l'application, sans re-calcul).
  const [termesTraduction, setTermesTraduction] = useState<Awaited<
    ReturnType<typeof computeTranslationTerms>
  > | null>(null);

  // Consolidation multilingue : questionnaire dupliqué par langue → fusion des
  // colonnes-variantes (`x_kh`, `x_viet`…) en une seule question. On détecte un
  // PLAN (à valider) avant d'appliquer, puis on adopte la base consolidée.
  const [busyConso, setBusyConso] = useState(false);
  const [consolide, setConsolide] = useState(false);
  const [consolideReload, setConsolideReload] = useState<Record<string, unknown> | null>(null);
  const [consoPlan, setConsoPlan] = useState<ConsolidationPlanResponse | null>(null);
  // Groupes cochés (à fusionner). Clé = canonical du groupe.
  const [consoGroupesSel, setConsoGroupesSel] = useState<Set<string>>(new Set());
  // Affectation manuelle des orphelins : variante → base choisie (ou '' = ignorer).
  const [consoOrphelins, setConsoOrphelins] = useState<Record<string, string>>({});
  const [consoInfo, setConsoInfo] = useState<{ nFusionnees: number; nApres: number } | null>(null);

  // Graphiques
  const [graphVar, setGraphVar] = useState('');
  const [graphType, setGraphType] = useState<'barres' | 'camembert'>('barres');
  const [graphFreq, setGraphFreq] = useState<FrequencyResponse | null>(null);
  const [busyGraph, setBusyGraph] = useState(false);

  // Filtres (sous-population appliquée à toutes les analyses)
  const [filtres, setFiltres] = useState<FilterCond[]>([]);
  const [fCol, setFCol] = useState('');
  const [fOp, setFOp] = useState<string>('=');
  const [fVal, setFVal] = useState('');
  // Modalités de la variable de filtre choisie (chargées automatiquement).
  const [modalites, setModalites] = useState<{ valeur: string; effectif: number }[]>([]);
  const [busyModalites, setBusyModalites] = useState(false);

  // Base brute (aperçu) + Liste
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busyPreview, setBusyPreview] = useState(false);
  const [listeCols, setListeCols] = useState<string[]>([]);
  const [liste, setListe] = useState<PreviewResponse | null>(null);
  const [busyListe, setBusyListe] = useState(false);
  // Masquer les lignes vides sur toutes les variables listées.
  const [listeExclureVides, setListeExclureVides] = useState(true);

  // Diagnostic qualité / anomalies
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [busyQuality, setBusyQuality] = useState(false);

  // Consultation d'un traitement enregistré (historique)
  const [detail, setDetail] = useState<TraitementDetail | null>(null);
  const [busyDetail, setBusyDetail] = useState(false);
  // Historique organisé en DOSSIERS par projet / jeu de données (accordéons).
  const [dossiersOuverts, setDossiersOuverts] = useState<Set<string>>(new Set());
  // Nom du fichier sélectionné (avant import) — pour détecter un doublon.
  const [refFichierChoisi, setRefFichierChoisi] = useState('');

  // Rapport (API Claude)
  const [formatRapport, setFormatRapport] = useState<FormatRapport>('synthese');
  const [docsSel, setDocsSel] = useState<string[]>([]);
  const [structureLibre, setStructureLibre] = useState('');
  const [consignes, setConsignes] = useState('');
  const [rapport, setRapport] = useState<string | null>(null);
  const [busyRapport, setBusyRapport] = useState(false);
  // Questions de compréhension posées par l'IA + réponses de l'utilisateur.
  const [questionsClar, setQuestionsClar] = useState<string[]>([]);
  const [reponsesClar, setReponsesClar] = useState<Record<number, string>>({});
  const [suggestionClar, setSuggestionClar] = useState('');
  const [busyClar, setBusyClar] = useState(false);
  const [clarFaite, setClarFaite] = useState(false);
  // Fichier modèle / ressource joint pour cadrer la présentation du rapport.
  const [modeleFichier, setModeleFichier] = useState<{ nom: string; texte: string } | null>(null);
  const [busyModele, setBusyModele] = useState(false);

  // Les colonnes compagnons « (VO) » (texte original des réponses ouvertes
  // traduites) sont EXCLUES des variables analytiques : elles n'impactent ni les
  // tris/croisements/rapports, ni la présélection. Elles restent visibles dans
  // l'onglet « Base brute » pour lecture (original + traduction côte à côte).
  const variables = (analyse?.variables ?? []).filter((v) => !v.name.endsWith(' (VO)'));

  // Projets du programme sélectionné (ou tous, en transversal).
  const projetsProgramme =
    mpProgramme === '__tous__' ? projets : projets.filter((p) => p.programme === mpProgramme);

  // Libellé lisible d'une variable (question posée) à partir de son code.
  const libelleVariable = (code: string) => variables.find((v) => v.name === code)?.display ?? code;

  // Enveloppe d'export : signale une éventuelle erreur sans casser l'UI.
  const exporter = (fn: () => Promise<void>) =>
    fn().catch((e) => setErreur(e instanceof Error ? e.message : 'Export impossible.'));

  const aDesResultats = Boolean(freq || cross || multi || stat);
  // Le rapport peut être généré dès qu'une base est chargée (les chiffres sont
  // calculés en arrière-plan si aucun résultat n'a encore été produit), ou —
  // même sans base — en format « personnalisé » à partir de la structure libre.
  const peutGenererRapport =
    aDesResultats ||
    Boolean(analyse) ||
    (formatRapport === 'personnalise' && structureLibre.trim().length > 0);

  // Source active des calculs (enquête en ligne ou fichier importé), filtres inclus.
  const source: ComputeSource | null = datasetRef
    ? { datasetRef, filters: filtres }
    : dataset
      ? { dataset, filters: filtres }
      : null;
  const estMulti = sourceMode === 'multi';
  const estBd = sourceMode === 'beneficiaires' || sourceMode === 'structures';
  const bdProjetCode = bdProjet !== '__tous__' ? bdProjet : '';
  const bdLabel = sourceMode === 'structures' ? 'Structures' : 'Bénéficiaires';
  // NB : les bases bénéficiaires/structures possèdent aussi un `datasetRef`
  // (déposé dans Storage), mais on les identifie par leur MODE (estBd) — et non
  // « upload » — pour conserver leur regroupement et recharger la BASE À JOUR.
  const sourceKind = estBd ? sourceMode : estMulti ? 'multi' : datasetRef ? 'upload' : 'enquete';
  const sourceRef = estBd
    ? bdProjetCode || sourceMode
    : estMulti
      ? mpIndicateur
      : datasetRef
        ? fichierNom
        : indicateur;
  const sourceLabel = estBd
    ? bdProjetCode
      ? `${bdLabel} — ${projets.find((p) => p.code === bdProjetCode)?.libelle ?? bdProjetCode}`
      : bdLabel
    : estMulti
      ? `Multi-projets — ${indicateurs.find((i) => i.code === mpIndicateur)?.libelle ?? mpIndicateur}`
      : datasetRef
        ? fichierNom
        : (indicateurs.find((i) => i.code === indicateur)?.libelle ?? indicateur);

  // De quoi recharger la source d'un traitement (pour rouvrir le workspace).
  const reloadInfo: Record<string, unknown> = estBd
    ? { kind: sourceMode, projet: bdProjetCode || null }
    : estMulti
      ? { kind: 'multi', indicateur: mpIndicateur, projets: mpProjets }
      : datasetRef
        ? { kind: 'upload', datasetRef, nom: fichierNom }
        : { kind: 'enquete', indicateur };
  // Rechargement à mémoriser pour un traitement produit MAINTENANT : si la base
  // de travail est la base épurée, on rouvre la base nettoyée (et non la brute).
  // Chaîne des transformations (de la source vers la base de travail) :
  //   source → consolidation → traduction → épuration.
  // Le descripteur courant est celui de la transformation la plus EXTERNE active.
  const reloadCourant: Record<string, unknown> =
    baseEpuree && epureeReload
      ? epureeReload
      : traduit && traduitReload
        ? traduitReload
        : consolide && consolideReload
          ? consolideReload
          : reloadInfo;

  // ---- Historique regroupé en DOSSIERS par projet / jeu de données ----
  const libelleIndic = (code: string) => indicateurs.find((i) => i.code === code)?.libelle ?? code;
  function labelDossier(kind: string, ref: string): string {
    if (kind === 'upload') return ref || 'Fichier importé';
    if (kind === 'multi') return `Multi-projets — ${libelleIndic(ref)}`;
    if (kind === 'beneficiaires' || kind === 'structures') {
      const base = kind === 'structures' ? 'Structures' : 'Bénéficiaires';
      const proj = projets.find((p) => p.code === ref);
      return ref && ref !== kind ? `${base} — ${proj?.libelle ?? ref}` : base;
    }
    return libelleIndic(ref);
  }
  type Dossier = {
    cle: string;
    kind: string;
    ref: string;
    label: string;
    jobs: HistoriqueJob[];
    derniere: string;
  };
  const dossiers: Dossier[] = (() => {
    const map = new Map<string, Dossier>();
    for (const j of historique.jobs) {
      const ref = j.source_ref ?? '';
      const cle = `${j.source}|${ref}`;
      let d = map.get(cle);
      if (!d) {
        d = {
          cle,
          kind: j.source,
          ref,
          label: labelDossier(j.source, ref),
          jobs: [],
          derniere: j.created_at,
        };
        map.set(cle, d);
      }
      d.jobs.push(j);
      if (j.created_at > d.derniere) d.derniere = j.created_at;
    }
    return [...map.values()].sort((a, b) => (a.derniere < b.derniere ? 1 : -1));
  })();

  // Détection de doublon : le jeu / projet en cours de sélection est-il déjà
  // présent dans l'archive ? Si oui, on invite l'utilisateur à ouvrir son dossier.
  const refImportCourant =
    sourceMode === 'fichier'
      ? refFichierChoisi || fichierNom
      : sourceMode === 'multi'
        ? mpIndicateur
        : indicateur;
  const kindImportCourant =
    sourceMode === 'fichier' ? 'upload' : sourceMode === 'multi' ? 'multi' : 'enquete';
  const dossierDoublon = refImportCourant
    ? dossiers.find((d) => d.kind === kindImportCourant && d.ref === refImportCourant)
    : undefined;

  function ouvrirDossier(cle: string) {
    setDossiersOuverts((prev) => new Set(prev).add(cle));
    if (typeof document !== 'undefined') {
      document.getElementById('archive-dossiers')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
  function basculerDossier(cle: string) {
    setDossiersOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      return next;
    });
  }

  function reinitAnalyse() {
    setFreq(null);
    setCross(null);
    setStat(null);
    setMulti(null);
    setClean(null);
    setGraphFreq(null);
    setRapport(null);
    setAnalyse(null);
    setBaseEpuree(false);
    setEpureeReload(null);
    setTraduit(false);
    setTraduitReload(null);
    setTraductionInfo(null);
    setColonnesOuvertes([]);
    setOuvertesSel(new Set());
    setProgressTrad('');
    setKeyCols([]);
    setConsolide(false);
    setConsolideReload(null);
    setConsoPlan(null);
    setConsoGroupesSel(new Set());
    setConsoOrphelins({});
    setConsoInfo(null);
  }

  function appliquerAnalyse(a: AnalyzeResponse) {
    setAnalyse(a);
    setVarsSel(preselectionIntelligente(a.variables, a.n_rows));
    // Défauts de croisement/tests : premières variables non techniques.
    const analysables = a.variables.filter((v) => !estVariableTechnique(v, a.n_rows));
    const first = (analysables[0] ?? a.variables[0])?.name ?? '';
    const second =
      (analysables[1] ?? analysables[0] ?? a.variables[1] ?? a.variables[0])?.name ?? '';
    setRow(first);
    setCol(second);
    setStatRow(first);
    setStatCol(second);
    setGraphVar(first);
    setGraphFreq(null);
    setFCol(first);
    setListeCols(a.variables.slice(0, 4).map((v) => v.name));
    setFiltres([]);
    setPreview(null);
    setListe(null);
    setQuality(null);
  }

  async function charger() {
    if (!indicateur) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const ds = await chargerDatasetEnqueteAction(indicateur);
      if (ds.rows.length === 0) {
        setErreur('Aucune réponse d’enquête pour cet indicateur.');
        return;
      }
      setDataset(ds);
      setDatasetRef(null);
      appliquerAnalyse(await analyzeDataset(ds));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function chargerMultiProjets() {
    if (!mpIndicateur) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const codes = mpProjets.length > 0 ? mpProjets : projetsProgramme.map((p) => p.code);
      const ds = await chargerDatasetMultiProjetsAction(mpIndicateur, codes);
      if (ds.rows.length === 0) {
        setErreur('Aucune réponse d’enquête pour cette sélection multi-projets.');
        return;
      }
      setDataset(ds);
      setDatasetRef(null);
      appliquerAnalyse(await analyzeDataset(ds));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  // Charge une base plateforme (bénéficiaires / structures), filtre projet inclus.
  async function chargerBaseBd(mode: 'beneficiaires' | 'structures') {
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const projet = bdProjet !== '__tous__' ? bdProjet : undefined;
      // La base (potentiellement des dizaines de milliers de lignes) est déposée
      // dans Storage ; on l'analyse ensuite par référence (comme un fichier
      // importé), sans jamais la faire transiter en entier à chaque calcul.
      const ref =
        mode === 'structures'
          ? await chargerDatasetStructuresAction(projet)
          : await chargerDatasetBeneficiairesAction(projet);
      if (ref.nRows === 0) {
        setErreur(
          mode === 'structures'
            ? 'Aucune structure pour cette sélection.'
            : 'Aucun bénéficiaire pour cette sélection.',
        );
        return;
      }
      const a = await ingestFile(ref.datasetRef);
      setDatasetRef(a.dataset_ref);
      setDataset(null);
      setFichierNom(ref.name || a.name);
      appliquerAnalyse(a);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function chargerFichier() {
    if (!fichier) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const path = await uploadSpssFile(fichier);
      const res = await ingestFile(path);
      setFichierPath(path);
      setFeuilles(res.sheets ?? []);
      setFeuilleSel(res.sheet ?? res.sheets?.[0] ?? null);
      setDatasetRef(res.dataset_ref);
      setDataset(null);
      setFichierNom(res.name || fichier.name);
      appliquerAnalyse(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  /** Change la feuille active d'un classeur importé : re-lit sans re-téléverser. */
  async function changerFeuille(feuille: string) {
    if (!fichierPath || feuille === feuilleSel) return;
    setChargement(true);
    setErreur(null);
    reinitAnalyse();
    try {
      const res = await ingestFile(fichierPath, { sheet: feuille });
      setFeuilles(res.sheets ?? feuilles);
      setFeuilleSel(res.sheet ?? feuille);
      setDatasetRef(res.dataset_ref);
      setDataset(null);
      setFichierNom(res.name || feuille);
      appliquerAnalyse(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setChargement(false);
    }
  }

  async function lancerFreq() {
    if (!source || varsSel.length === 0) return;
    setBusyFreq(true);
    setErreur(null);
    try {
      const res = await computeFrequency(source, varsSel, exclure);
      setFreq(res);
      // Enregistrement best-effort dans l'historique (n'interrompt pas l'analyse).
      await enregistrerTraitementAction({
        type: 'frequency',
        titre: `Tris à plat — ${varsSel.length} variable(s)`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { cols: varsSel, exclure, source: sourceRef, _reload: reloadCourant },
        payload: res as unknown as Record<string, unknown>,
        apercu: `${varsSel.length} variable(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyFreq(false);
    }
  }

  async function lancerCross() {
    if (!source || !row || !col) return;
    setBusyCross(true);
    setErreur(null);
    try {
      const lyr = layer === AUCUNE ? null : layer;
      const res = await computeCrosstab(source, row, col, lyr, pctMode);
      setCross(res);
      await enregistrerTraitementAction({
        type: 'crosstab',
        titre: `Croisement ${row} × ${col}`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { row, col, layer: lyr, pctMode, source: sourceRef, _reload: reloadCourant },
        payload: res as unknown as Record<string, unknown>,
        apercu: `${res.layers.length} table(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyCross(false);
    }
  }

  async function lancerStat() {
    if (!source || !statRow || !statCol) return;
    setBusyStat(true);
    setErreur(null);
    try {
      const res = await computeStatTest(source, statRow, statCol);
      setStat(res);
      await enregistrerTraitementAction({
        type: 'stat_test',
        titre: `Tests statistiques ${statRow} × ${statCol}`,
        source: sourceKind,
        source_ref: sourceRef,
        params: { row: statRow, col: statCol, source: sourceRef, _reload: reloadCourant },
        payload: res as unknown as Record<string, unknown>,
        apercu: [
          res.chi_square.applicable ? `χ² p=${res.chi_square.p.toFixed(4)}` : 'χ² n/a',
          res.welch_ttest.applicable ? `t p=${res.welch_ttest.p.toFixed(4)}` : 't n/a',
        ].join(' · '),
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyStat(false);
    }
  }

  async function lancerMulti() {
    if (!source) return;
    setBusyMulti(true);
    setErreur(null);
    try {
      const res = await computeMulti(source);
      setMulti(res);
      const nb = Object.keys(res.tables).length;
      if (nb > 0) {
        await enregistrerTraitementAction({
          type: 'multi',
          titre: `Réponses multiples — ${nb} batterie(s)`,
          source: sourceKind,
          source_ref: sourceRef,
          params: { source: sourceRef, _reload: reloadCourant },
          payload: res as unknown as Record<string, unknown>,
          apercu: `${nb} batterie(s)`,
        });
        router.refresh();
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyMulti(false);
    }
  }

  async function lancerClean() {
    if (!source) return;
    setBusyClean(true);
    setErreur(null);
    try {
      const res = await computeClean(source, {
        normaliserManquants: normMissing,
        trimEspaces,
        arrondir,
        dropEmpty,
        dropDuplicates,
        dropMissing,
        keyColumns: keyCols,
      });
      setClean(res);
      await enregistrerTraitementAction({
        type: 'cleaning',
        titre: `Base épurée — ${res.n_rows_cleaned}/${res.n_rows_source} lignes`,
        source: sourceKind,
        source_ref: sourceRef,
        params: {
          drop_empty: dropEmpty,
          drop_duplicates: dropDuplicates,
          drop_missing: dropMissing,
          key_columns: keyCols,
          source: sourceRef,
          _reload: reloadCourant,
        },
        apercu: `${res.n_removed} ligne(s) retirée(s)`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyClean(false);
    }
  }

  /**
   * Adopte la base ÉPURÉE comme base de travail active (et l'enregistre dans
   * l'historique). Toutes les analyses suivantes (tri à plat, liste, rapport…)
   * portent alors sur cette base nettoyée. Le traitement enregistré mémorise la
   * source d'origine et les options de nettoyage : rouvrir ce traitement
   * reconstruit la base épurée à l'identique.
   */
  async function appliquerBaseEpuree() {
    if (!source) return;
    setBusyClean(true);
    setErreur(null);
    try {
      const res = await computeClean(source, {
        normaliserManquants: normMissing,
        trimEspaces,
        arrondir,
        dropEmpty,
        dropDuplicates,
        dropMissing,
        keyColumns: keyCols,
        full: true,
      });
      if (!res.dataset || !Array.isArray(res.dataset.rows)) {
        setErreur("La base épurée n'a pas pu être générée.");
        return;
      }
      const ds = res.dataset;
      setDataset(ds);
      setDatasetRef(null);
      // On repart d'une base propre côté analyses, mais on conserve l'aperçu
      // du nettoyage et le drapeau « base épurée ».
      setFreq(null);
      setCross(null);
      setStat(null);
      setMulti(null);
      setRapport(null);
      appliquerAnalyse(await analyzeDataset(ds));
      setClean(res);
      setBaseEpuree(true);
      const reloadEpuree = {
        kind: 'epuree',
        // On épure PAR-DESSUS les transformations déjà appliquées : le descripteur
        // pointe la base la plus externe (traduite, sinon consolidée, sinon brute)
        // pour reconstruire la chaîne complète au rechargement.
        base:
          traduit && traduitReload
            ? traduitReload
            : consolide && consolideReload
              ? consolideReload
              : reloadInfo,
        normMissing,
        trimEspaces,
        arrondir,
        dropEmpty,
        dropDuplicates,
        dropMissing,
        keyCols,
      };
      // Mémorise ce descripteur : les traitements suivants (tris, rapport…)
      // produits sur cette base rouvriront la base épurée.
      setEpureeReload(reloadEpuree);
      await enregistrerTraitementAction({
        type: 'cleaning',
        titre: `Base épurée adoptée — ${res.n_rows_cleaned}/${res.n_rows_source} lignes`,
        source: sourceKind,
        source_ref: sourceRef,
        params: {
          drop_empty: dropEmpty,
          drop_duplicates: dropDuplicates,
          drop_missing: dropMissing,
          key_columns: keyCols,
          source: sourceRef,
          _reload: reloadEpuree,
        },
        apercu: `Base de travail : ${res.n_rows_cleaned} lignes (${res.n_removed} retirée(s))`,
      });
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyClean(false);
    }
  }

  /**
   * Étape 1 — Détection : recense (sans IA) en-têtes, modalités et surtout les
   * colonnes de RÉPONSES OUVERTES (texte libre), pour proposer une sélection à
   * traduire par lots avant de lancer la traduction.
   */
  async function detecterTraduction() {
    if (!source) {
      setErreur('Chargez d’abord une base à traduire.');
      return;
    }
    setBusyTrad(true);
    setErreur(null);
    setProgressTrad('Analyse de la base…');
    try {
      const termes = await computeTranslationTerms(source);
      if (!termes.columns || termes.columns.length === 0) {
        setErreur('Aucune colonne à traduire dans cette base.');
        return;
      }
      setTermesTraduction(termes);
      const ouvertes = termes.free_text_columns ?? [];
      setColonnesOuvertes(ouvertes);
      // Réponses ouvertes toutes cochées par défaut (l'utilisateur peut décocher).
      setOuvertesSel(new Set(ouvertes));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyTrad(false);
      setProgressTrad('');
    }
  }

  /**
   * Étape 2 — Traduction (IA) vers la langue cible. On envoie à Claude UNIQUEMENT
   * les termes (en-têtes + modalités) et, pour les réponses ouvertes cochées,
   * leurs valeurs distinctes par lots — jamais la base entière. On adopte ensuite
   * la base traduite comme base de travail. Le texte ORIGINAL des réponses
   * ouvertes est conservé dans une colonne « (VO) » exclue des analyses/rapports.
   */
  async function appliquerTraduction() {
    if (!source) {
      setErreur('Chargez d’abord une base à traduire.');
      return;
    }
    // Sécurité : si la détection n'a pas encore tourné, on la lance d'abord.
    let termes = termesTraduction;
    if (!termes) {
      await detecterTraduction();
      termes = termesTraduction;
      if (!termes) return;
    }
    const termesOk = termes;
    setBusyTrad(true);
    setErreur(null);
    try {
      // 1) Détection de langue + table de traduction (en-têtes + modalités).
      setProgressTrad('Traduction des en-têtes et des modalités…');
      const trad = await traduireTermesAction({
        columns: termesOk.columns,
        values: termesOk.values,
        sample: termesOk.sample,
        langueCible,
      });
      if (trad.status !== 'succes') {
        setErreur(trad.message);
        return;
      }
      const valueMaps: Record<string, Record<string, string>> = { ...trad.valueMaps };

      // 2) Réponses ouvertes cochées : traduction par lots des valeurs distinctes.
      const dispo = termesOk.free_text_columns ?? [];
      const colsOuvertes = [...ouvertesSel].filter((c) => dispo.includes(c));
      if (colsOuvertes.length > 0) {
        setProgressTrad('Récupération des réponses ouvertes…');
        const ft = await computeTranslationFreetext(source, colsOuvertes);
        const uniques = Array.from(new Set(Object.values(ft.values).flat()));
        const global: Record<string, string> = {};
        const nbLots = Math.max(1, Math.ceil(uniques.length / TAILLE_LOT_TEXTES));
        for (let i = 0; i < uniques.length; i += TAILLE_LOT_TEXTES) {
          const lot = uniques.slice(i, i + TAILLE_LOT_TEXTES);
          setProgressTrad(
            `Traduction des réponses ouvertes… lot ${Math.floor(i / TAILLE_LOT_TEXTES) + 1}/${nbLots}`,
          );
          const res = await traduireTextesLibresAction({ textes: lot, langueCible });
          if (res.status !== 'succes') {
            setErreur(res.message);
            return;
          }
          Object.assign(global, res.map);
        }
        for (const col of colsOuvertes) {
          const vals = ft.values[col] ?? [];
          const m: Record<string, string> = { ...(valueMaps[col] ?? {}) };
          for (const v of vals) if (global[v]) m[v] = global[v];
          if (Object.keys(m).length > 0) valueMaps[col] = m;
        }
      }

      const nbValeurs = Object.values(valueMaps).reduce((a, m) => a + Object.keys(m).length, 0);
      // 3) Application → base traduite complète (avec colonnes « (VO) »).
      setProgressTrad('Application de la traduction à la base…');
      const nomTraduit = `${sourceLabel || 'Base'} (traduit ${langueCible})`;
      const rt = await computeTranslate(source, trad.columnMap, valueMaps, {
        full: true,
        name: nomTraduit,
        freeTextColumns: colsOuvertes,
      });
      if (!rt.dataset || !Array.isArray(rt.dataset.rows)) {
        setErreur('La base traduite n’a pas pu être générée.');
        return;
      }
      const ds = rt.dataset;
      // 4) Adoption comme base de travail : la suite se fait en langue cible.
      setDataset(ds);
      setDatasetRef(null);
      setFreq(null);
      setCross(null);
      setStat(null);
      setMulti(null);
      setRapport(null);
      appliquerAnalyse(await analyzeDataset(ds));
      setTraduit(true);
      setTraductionInfo({
        langueDetectee: trad.langueDetectee,
        langueCible: trad.langueCible,
        nbColonnes: Object.keys(trad.columnMap).length,
        nbValeurs,
        nbOuvertes: colsOuvertes.length,
      });
      // Descripteur de rechargement : reproduit la traduction sur la base d'origine.
      const reloadTraduit: ReloadDesc = {
        kind: 'traduit',
        // On traduit par-dessus la consolidation si elle est active (chaîne complète).
        base: (consolide && consolideReload ? consolideReload : reloadInfo) as ReloadDesc,
        columnMap: trad.columnMap,
        valueMaps,
        freeTextColumns: colsOuvertes,
        name: nomTraduit,
        langueCible: trad.langueCible,
      };
      setTraduitReload(reloadTraduit as unknown as Record<string, unknown>);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyTrad(false);
      setProgressTrad('');
    }
  }

  /**
   * Consolidation — étape 1 : détecte (sans IA) les colonnes-variantes de langue
   * d'une même question (questionnaire dupliqué par langue) et propose un PLAN de
   * fusion à VALIDER (groupes cochés + orphelins à rattacher) avant application.
   */
  async function detecterConsolidation() {
    if (!source) {
      setErreur('Chargez d’abord une base à consolider.');
      return;
    }
    setBusyConso(true);
    setErreur(null);
    try {
      const plan = await computeConsolidationPlan(source);
      setConsoPlan(plan);
      // Groupes auto-détectés cochés par défaut (l'utilisateur peut décocher).
      setConsoGroupesSel(new Set(plan.plan.map((g) => g.canonical)));
      // Orphelins pré-affectés à la base suggérée (modifiable, ou « ignorer »).
      const aff: Record<string, string> = {};
      for (const o of plan.orphelins) aff[o.variant] = o.suggestion ?? '';
      setConsoOrphelins(aff);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyConso(false);
    }
  }

  /**
   * Construit la liste des groupes à fusionner à partir du plan validé : groupes
   * cochés + orphelins rattachés à une base (fusionnés dans le groupe de cette
   * base, ou nouveau groupe si la base n'était pas déjà un groupe).
   */
  function construireGroupesConso(): { canonical: string; members: string[] }[] {
    if (!consoPlan) return [];
    const parCanon = new Map<string, Set<string>>();
    for (const g of consoPlan.plan) {
      if (!consoGroupesSel.has(g.canonical)) continue;
      parCanon.set(g.canonical, new Set(g.members));
    }
    for (const [variant, base] of Object.entries(consoOrphelins)) {
      if (!base) continue; // « ignorer » : orphelin laissé tel quel.
      let membres = parCanon.get(base);
      if (!membres) {
        membres = new Set([base]);
        parCanon.set(base, membres);
      }
      membres.add(variant);
    }
    return [...parCanon.entries()]
      .filter(([, m]) => m.size >= 2)
      .map(([canonical, m]) => ({ canonical, members: [...m] }));
  }

  /**
   * Consolidation — étape 2 : applique la fusion des groupes validés (1re valeur
   * non vide par ligne) et adopte la base consolidée comme base de travail. Comme
   * la traduction, l'opération remplace la base ; la chaîne est retrouvée via le
   * descripteur `_reload` des traitements produits ensuite.
   */
  async function appliquerConsolidation() {
    if (!source) {
      setErreur('Chargez d’abord une base à consolider.');
      return;
    }
    const groupes = construireGroupesConso();
    if (groupes.length === 0) {
      setErreur('Sélectionnez au moins un groupe de variables à fusionner.');
      return;
    }
    setBusyConso(true);
    setErreur(null);
    try {
      const nom = `${sourceLabel || 'Base'} (consolidé)`;
      const res = await computeConsolidate(source, groupes, { full: true, name: nom });
      if (!res.dataset || !Array.isArray(res.dataset.rows)) {
        setErreur('La base consolidée n’a pas pu être générée.');
        return;
      }
      const ds = res.dataset;
      setDataset(ds);
      setDatasetRef(null);
      setFreq(null);
      setCross(null);
      setStat(null);
      setMulti(null);
      setRapport(null);
      appliquerAnalyse(await analyzeDataset(ds));
      setConsolide(true);
      setConsoInfo({ nFusionnees: res.n_fusionnees, nApres: res.n_variables });
      // Descripteur de rechargement : reproduit la consolidation sur la base brute.
      const reloadConso: ReloadDesc = {
        kind: 'consolide',
        base: reloadInfo as ReloadDesc,
        groups: groupes,
        name: nom,
      };
      setConsolideReload(reloadConso as unknown as Record<string, unknown>);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyConso(false);
    }
  }

  async function lancerGraph() {
    if (!source || !graphVar) return;
    setBusyGraph(true);
    setErreur(null);
    try {
      setGraphFreq(await computeFrequency(source, [graphVar], true));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyGraph(false);
    }
  }

  async function chargerPreview() {
    if (!source) return;
    setBusyPreview(true);
    setErreur(null);
    try {
      setPreview(await computePreview(source, 100));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyPreview(false);
    }
  }

  async function lancerListe() {
    if (!source || listeCols.length === 0) return;
    setBusyListe(true);
    setErreur(null);
    try {
      setListe(await computeList(source, listeCols, 200, listeExclureVides));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyListe(false);
    }
  }

  async function lancerQuality() {
    if (!source) return;
    setBusyQuality(true);
    setErreur(null);
    try {
      setQuality(await computeQuality(source));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyQuality(false);
    }
  }

  function ajouterFiltre() {
    if (!fCol) return;
    setFiltres((prev) => [...prev, { col: fCol, op: fOp, val: fVal }]);
    setFVal('');
  }

  // Charge automatiquement les modalités de la variable de filtre choisie, pour
  // que l'utilisateur sélectionne une valeur EXISTANTE (au lieu de la saisir).
  useEffect(() => {
    let annule = false;
    async function charger() {
      if (!fCol || !source) {
        setModalites([]);
        return;
      }
      setBusyModalites(true);
      try {
        const r = await computeModalities(source, fCol, 500);
        if (!annule) setModalites(r.modalites);
      } catch {
        if (!annule) setModalites([]);
      } finally {
        if (!annule) setBusyModalites(false);
      }
    }
    charger();
    return () => {
      annule = true;
    };
    // On ne dépend pas de `source` (recréé à chaque rendu) mais de l'identité de
    // la base : la variable choisie, le dataset en mémoire ou la référence fichier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fCol, dataset, datasetRef]);

  /**
   * Barre de filtre « sous-population » intégrée, à afficher EN TÊTE de chaque
   * onglet d'analyse. Elle rend toujours visible la sous-population active (ou son
   * absence) et permet d'ajouter un filtre par variable sans quitter l'analyse.
   * Elle agit sur le même état `filtres` que l'onglet Filtres : les conditions
   * s'appliquent donc à TOUTES les analyses et restent cohérentes partout.
   */
  function renderFiltreInline() {
    if (!analyse) return null;
    const compare = ['>', '≥', '<', '≤'].includes(fOp);
    return (
      <div
        className={`rounded-md border p-3 ${
          filtres.length > 0
            ? 'border-[#0E4F88]/30 bg-[#0E4F88]/5'
            : 'bg-slate-50/60 dark:bg-slate-900/30'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
            <Filter className="size-3.5" /> Sous-population
          </span>
          {filtres.length === 0 ? (
            <span className="text-muted-foreground text-xs italic">
              toute la base (aucun filtre)
            </span>
          ) : (
            <>
              {filtres.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 py-0.5">
                  {libelleVariable(f.col)} {f.op} {f.val || '∅'}
                  <button
                    type="button"
                    aria-label="Retirer"
                    onClick={() => setFiltres((prev) => prev.filter((_, j) => j !== i))}
                    className="hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                className="text-muted-foreground text-xs hover:underline"
                onClick={() => setFiltres([])}
              >
                tout effacer
              </button>
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-[10px]">Variable</p>
            <Select value={fCol || undefined} onValueChange={(v) => setFCol(v ?? '')}>
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="Choisir une variable" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {variables.map((v) => (
                  <SelectItem key={v.name} value={v.name}>
                    {v.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-[10px]">Opérateur</p>
            <Select value={fOp} onValueChange={(v) => setFOp(v ?? '=')}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATEURS_FILTRE.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-[10px]">Valeur</p>
            {compare ? (
              <Input
                value={fVal}
                onChange={(e) => setFVal(e.target.value)}
                placeholder="ex. 25"
                inputMode="decimal"
                className="h-8 w-32 text-xs"
              />
            ) : fOp === 'contient' ? (
              <Input
                value={fVal}
                onChange={(e) => setFVal(e.target.value)}
                placeholder="texte à rechercher…"
                className="h-8 w-44 text-xs"
              />
            ) : (
              <Select
                value={fVal || undefined}
                onValueChange={(v) => setFVal(v ?? '')}
                disabled={!fCol || busyModalites || modalites.length === 0}
              >
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue
                    placeholder={
                      !fCol
                        ? 'Choisir une variable'
                        : busyModalites
                          ? 'Chargement…'
                          : modalites.length === 0
                            ? 'Aucune modalité'
                            : 'Choisir une modalité'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {modalites.map((m) => (
                    <SelectItem key={m.valeur} value={m.valeur}>
                      {m.valeur} ({m.effectif})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={ajouterFiltre}
            disabled={!fCol || !fVal}
          >
            <Filter className="size-3.5" /> Filtrer
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Reconstruit une base de travail (et l'état UI de sa source) à partir d'un
   * descripteur de rechargement. Gère les sources simples (fichier importé,
   * enquête, multi-projets, bénéficiaires, structures) et, récursivement, les
   * bases transformées (traduite) — ce qui permet de rouvrir une chaîne
   * « importer → traduire ». Renvoie la source de calcul, ou null si elle n'a
   * pas pu être reconstruite. (L'épuration reste gérée dans son propre bloc.)
   */
  async function chargerSourceReload(
    desc: ReloadDesc | null | undefined,
  ): Promise<ComputeSource | null> {
    if (!desc || !desc.kind) return null;
    if (desc.kind === 'upload' && desc.datasetRef) {
      const a = await ingestFile(desc.datasetRef);
      setDatasetRef(a.dataset_ref);
      setDataset(null);
      setFichierNom(desc.nom || a.name);
      setSourceMode('fichier');
      setFichierPath(desc.datasetRef.split('#')[0] ?? null);
      setFeuilles(a.sheets ?? []);
      setFeuilleSel(a.sheet ?? a.sheets?.[0] ?? null);
      return { datasetRef: a.dataset_ref };
    }
    if (desc.kind === 'enquete' && desc.indicateur) {
      const ds = await chargerDatasetEnqueteAction(desc.indicateur);
      setIndicateur(desc.indicateur);
      setSourceMode('enquete');
      setDataset(ds);
      setDatasetRef(null);
      return { dataset: ds };
    }
    if (desc.kind === 'multi' && desc.indicateur) {
      const codes = Array.isArray(desc.projets) ? desc.projets : [];
      const ds = await chargerDatasetMultiProjetsAction(desc.indicateur, codes);
      setSourceMode('multi');
      setMpIndicateur(desc.indicateur);
      setMpProjets(codes);
      setDataset(ds);
      setDatasetRef(null);
      return { dataset: ds };
    }
    if (desc.kind === 'beneficiaires' || desc.kind === 'structures') {
      const projet = desc.projet || undefined;
      // La base est re-déposée dans Storage (données À JOUR) puis lue par référence.
      const ref =
        desc.kind === 'structures'
          ? await chargerDatasetStructuresAction(projet)
          : await chargerDatasetBeneficiairesAction(projet);
      const a = await ingestFile(ref.datasetRef);
      setSourceMode(desc.kind);
      setBdProjet(desc.projet || '__tous__');
      setDatasetRef(a.dataset_ref);
      setDataset(null);
      setFichierNom(ref.name || a.name);
      return { datasetRef: a.dataset_ref };
    }
    if (desc.kind === 'consolide' && desc.base) {
      const baseSource = await chargerSourceReload(desc.base);
      if (!baseSource) return null;
      const rc = await computeConsolidate(baseSource, desc.groups ?? [], {
        full: true,
        name: desc.name,
      });
      if (rc.dataset && Array.isArray(rc.dataset.rows)) {
        setDataset(rc.dataset);
        setDatasetRef(null);
        setConsolide(true);
        setConsolideReload(desc as unknown as Record<string, unknown>);
        setConsoInfo({ nFusionnees: rc.n_fusionnees, nApres: rc.n_variables });
        return { dataset: rc.dataset };
      }
      return null;
    }
    if (desc.kind === 'traduit' && desc.base) {
      const baseSource = await chargerSourceReload(desc.base);
      if (!baseSource) return null;
      const rt = await computeTranslate(baseSource, desc.columnMap ?? {}, desc.valueMaps ?? {}, {
        full: true,
        name: desc.name,
        freeTextColumns: desc.freeTextColumns ?? [],
      });
      if (rt.dataset && Array.isArray(rt.dataset.rows)) {
        setDataset(rt.dataset);
        setDatasetRef(null);
        setTraduit(true);
        setTraduitReload(desc as unknown as Record<string, unknown>);
        return { dataset: rt.dataset };
      }
      return null;
    }
    return null;
  }

  function chargerResultatDansOnglet(d: TraitementDetail) {
    const p = d.payload;
    const params = (d.params ?? {}) as { row?: string; col?: string; format?: string };
    if (d.type === 'frequency' && p) {
      setFreq(p as unknown as FrequencyResponse);
      setOngletActif('freq');
    } else if (d.type === 'crosstab' && p) {
      const cr = p as unknown as CrosstabResponse;
      setCross(cr);
      if (cr.row) setRow(cr.row);
      if (cr.col) setCol(cr.col);
      if (cr.layer) setLayer(cr.layer);
      if (cr.pct_mode) setPctMode(cr.pct_mode as 'Ligne' | 'Colonne');
      setOngletActif('cross');
    } else if (d.type === 'multi' && p) {
      setMulti(p as unknown as MultiResponse);
      setOngletActif('multi');
    } else if (d.type === 'stat_test' && p) {
      setStat(p as unknown as StatTestResponse);
      if (params.row) setStatRow(params.row);
      if (params.col) setStatCol(params.col);
      setOngletActif('stat');
    } else if (d.type === 'report' && p) {
      setRapport((p as { rapport?: string }).rapport ?? '');
      if (params.format) setFormatRapport(params.format as FormatRapport);
      setOngletActif('rapport');
    } else if (d.type === 'cleaning') {
      setOngletActif('clean');
    }
  }

  async function restaurerTraitement(jobId: string) {
    setBusyDetail(true);
    setErreur(null);
    try {
      const res = await chargerTraitementAction(jobId);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      const d = res.detail;
      const reload = (d.params?._reload ?? null) as ReloadDesc | null;

      // Rechargement de la source en MEILLEUR EFFORT : on tente de rouvrir la
      // base d'origine pour pouvoir ré-exécuter/compléter le traitement. Même si
      // cela échoue (fichier expiré, ancien traitement sans info de source), on
      // réinjecte ensuite le résultat enregistré dans l'espace de travail —
      // jamais un simple aperçu en lecture seule.
      try {
        if (reload?.kind === 'epuree' && reload.base) {
          // Base épurée : on recharge la source (y compris une base traduite,
          // via le résolveur récursif) puis on reconstruit la base nettoyée.
          const baseSource = await chargerSourceReload(reload.base);
          if (baseSource) {
            const rClean = await computeClean(baseSource, {
              normaliserManquants: reload.normMissing ?? true,
              trimEspaces: reload.trimEspaces ?? true,
              arrondir: reload.arrondir ?? true,
              dropEmpty: reload.dropEmpty ?? true,
              dropDuplicates: reload.dropDuplicates ?? true,
              dropMissing: reload.dropMissing ?? false,
              keyColumns: Array.isArray(reload.keyCols) ? reload.keyCols : [],
              full: true,
            });
            setKeyCols(Array.isArray(reload.keyCols) ? reload.keyCols : []);
            if (rClean.dataset && Array.isArray(rClean.dataset.rows)) {
              setDataset(rClean.dataset);
              setDatasetRef(null);
              setFreq(null);
              setCross(null);
              setStat(null);
              setMulti(null);
              setRapport(null);
              appliquerAnalyse(await analyzeDataset(rClean.dataset));
              setClean(rClean);
              setBaseEpuree(true);
              setEpureeReload(reload);
            }
          }
        } else if (reload?.kind === 'upload' && reload.datasetRef) {
          if (datasetRef !== reload.datasetRef) {
            const a = await ingestFile(reload.datasetRef);
            setDatasetRef(a.dataset_ref);
            setDataset(null);
            setFichierNom(reload.nom || a.name);
            setSourceMode('fichier');
            // Restaure le sélecteur de feuilles (base = chemin sans fragment).
            setFichierPath(reload.datasetRef.split('#')[0] ?? null);
            setFeuilles(a.sheets ?? []);
            setFeuilleSel(a.sheet ?? a.sheets?.[0] ?? null);
            appliquerAnalyse(a);
          }
        } else if (reload?.kind === 'enquete' && reload.indicateur) {
          if (indicateur !== reload.indicateur || !dataset) {
            const ds = await chargerDatasetEnqueteAction(reload.indicateur);
            setIndicateur(reload.indicateur);
            setDataset(ds);
            setDatasetRef(null);
            setSourceMode('enquete');
            appliquerAnalyse(await analyzeDataset(ds));
          }
        } else if (reload?.kind === 'multi' && reload.indicateur) {
          const codes = Array.isArray(reload.projets) ? reload.projets : [];
          if (sourceMode !== 'multi' || mpIndicateur !== reload.indicateur || !dataset) {
            const ds = await chargerDatasetMultiProjetsAction(reload.indicateur, codes);
            setSourceMode('multi');
            setMpIndicateur(reload.indicateur);
            setMpProjets(codes);
            setDataset(ds);
            setDatasetRef(null);
            appliquerAnalyse(await analyzeDataset(ds));
          }
        } else if (reload?.kind === 'beneficiaires' || reload?.kind === 'structures') {
          const projet = reload.projet || undefined;
          // Base re-déposée dans Storage (à jour) puis analysée par référence.
          const ref =
            reload.kind === 'structures'
              ? await chargerDatasetStructuresAction(projet)
              : await chargerDatasetBeneficiairesAction(projet);
          const a = await ingestFile(ref.datasetRef);
          setSourceMode(reload.kind);
          setBdProjet(reload.projet || '__tous__');
          setDatasetRef(a.dataset_ref);
          setDataset(null);
          setFichierNom(ref.name || a.name);
          appliquerAnalyse(a);
        } else if (reload?.kind === 'traduit' && reload.base) {
          // Base traduite : on recharge la source d'origine puis on réapplique la
          // traduction mémorisée (le résolveur pose la base traduite en mémoire).
          const src = await chargerSourceReload(reload);
          if (src && 'dataset' in src && src.dataset) {
            setTraductionInfo({
              langueDetectee: '',
              langueCible: reload.langueCible || 'Français',
              nbColonnes: Object.keys(reload.columnMap ?? {}).length,
              nbValeurs: Object.values(reload.valueMaps ?? {}).reduce(
                (acc, m) => acc + Object.keys(m).length,
                0,
              ),
            });
            appliquerAnalyse(await analyzeDataset(src.dataset));
          }
        } else if (reload?.kind === 'consolide' && reload.base) {
          // Base consolidée : on recharge la source puis on réapplique la fusion
          // mémorisée (le résolveur récursif pose la base consolidée en mémoire).
          const src = await chargerSourceReload(reload);
          if (src && 'dataset' in src && src.dataset) {
            appliquerAnalyse(await analyzeDataset(src.dataset));
          }
        }
      } catch (eSource) {
        // La source n'a pas pu être rechargée : on garde quand même le résultat
        // éditable (le rapport/tri reste consultable, exportable et regénérable).
        console.warn('[atelier-analyse] Source du traitement non rechargée', eSource);
      }

      // Dans TOUS les cas : réinjection du résultat dans son onglet (édition
      // complète), au lieu d'un aperçu en lecture seule.
      chargerResultatDansOnglet(d);
      setDetail(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.');
    } finally {
      setBusyDetail(false);
    }
  }

  // Demande à l'IA des questions de compréhension pour cadrer les axes du
  // rapport (ex. distinguer « utilisation des compétences » des « retombées »).
  async function clarifier() {
    if (!structureLibre.trim()) {
      setErreur('Renseignez d’abord la structure / les axes du rapport souhaité.');
      return;
    }
    setBusyClar(true);
    setErreur(null);
    try {
      const res = await clarifierRapportAction({
        format: formatRapport,
        structureLibre: structureLibre,
        consignes: consignes || undefined,
        variables: variables.map((v) => v.display),
        modeleTexte: modeleFichier?.texte,
        modeleNom: modeleFichier?.nom,
      });
      if (res.status === 'succes') {
        setQuestionsClar(res.questions);
        setSuggestionClar(res.suggestion);
        setReponsesClar({});
        setClarFaite(true);
      } else {
        setErreur(res.message);
      }
    } finally {
      setBusyClar(false);
    }
  }

  // Joint un fichier MODÈLE / RESSOURCE (PDF, Word, texte) : l'IA s'en inspire
  // pour la présentation du rapport (structure, rubriques), sans en tirer de chiffres.
  async function joindreModele(file: File) {
    setBusyModele(true);
    setErreur(null);
    try {
      const path = await uploadSpssFile(file);
      const res = await extraireModeleRapportAction(path);
      if (res.status === 'succes') {
        setModeleFichier({ nom: res.nom, texte: res.texte });
      } else {
        setErreur(res.message);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Fichier non joint.');
    } finally {
      setBusyModele(false);
    }
  }

  async function viderHistorique() {
    if (!estSuperAdmin) return;
    if (
      !window.confirm('Vider toute l’archive de vos traitements ? Cette action est irréversible.')
    )
      return;
    setBusyDetail(true);
    setErreur(null);
    try {
      const res = await viderHistoriqueAction();
      if (res.ok) {
        setDossiersOuverts(new Set());
        router.refresh();
      } else {
        setErreur(res.erreur ?? 'Suppression impossible.');
      }
    } finally {
      setBusyDetail(false);
    }
  }

  async function lancerRapport() {
    if (!peutGenererRapport) return;
    setBusyRapport(true);
    setErreur(null);
    try {
      const precisions =
        questionsClar.length > 0
          ? questionsClar
              .map((q, i) => `Q: ${q}\nR: ${(reponsesClar[i] ?? '').trim() || '(sans réponse)'}`)
              .join('\n\n')
          : undefined;
      // Charge les chiffres en arrière-plan : si aucune analyse n'a encore été
      // produite mais qu'une base est chargée, on calcule un tri à plat sur les
      // variables analysables pour que le rapport s'appuie sur de vraies données
      // (au lieu d'un rapport « en l'absence de données »).
      let freqRapport = freq;
      if (!freq && !cross && !multi && !stat && source && analyse) {
        const analysables = analyse.variables
          .filter((v) => !estVariableTechnique(v, analyse.n_rows))
          .map((v) => v.name);
        const cibles = (
          analysables.length > 0 ? analysables : analyse.variables.map((v) => v.name)
        ).slice(0, 20);
        if (cibles.length > 0) {
          freqRapport = await computeFrequency(source, cibles, true);
          setFreq(freqRapport);
        }
      }
      const res = await genererRapportAction({
        indicateur: sourceRef,
        indicateurLibelle: sourceLabel,
        format: formatRapport,
        consignes: consignes || undefined,
        frequences: freqRapport,
        croisement: cross,
        multi,
        tests: stat,
        documentRefs: docsSel,
        reload: reloadCourant,
        structureLibre: structureLibre || undefined,
        precisions,
        modeleTexte: modeleFichier?.texte,
        modeleNom: modeleFichier?.nom,
      });
      if (res.status === 'succes') {
        setRapport(res.rapport);
        router.refresh();
      } else {
        setErreur(res.message);
      }
    } finally {
      setBusyRapport(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Source de données */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Source des données
          </CardTitle>
          <CardDescription>
            Analysez les réponses d’enquête de la plateforme, ou importez un fichier : SPSS (.sav),
            Excel (.xlsx, .xls), LibreOffice (.ods), CSV/TSV/TAB, JSON, tableau Word (.docx), et
            tout export Kobo/CSPro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Choix de la source */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'enquete' ? 'default' : 'outline'}
              onClick={() => setSourceMode('enquete')}
            >
              <Database className="size-4" /> Depuis une enquête
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'fichier' ? 'default' : 'outline'}
              onClick={() => setSourceMode('fichier')}
            >
              <Upload className="size-4" /> Importer un fichier
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'multi' ? 'default' : 'outline'}
              onClick={() => setSourceMode('multi')}
            >
              <Layers className="size-4" /> Multi-projets
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'beneficiaires' ? 'default' : 'outline'}
              onClick={() => setSourceMode('beneficiaires')}
            >
              <Database className="size-4" /> Bénéficiaires
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === 'structures' ? 'default' : 'outline'}
              onClick={() => setSourceMode('structures')}
            >
              <Database className="size-4" /> Structures
            </Button>
          </div>

          {estBd && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1 space-y-1">
                <p className="text-muted-foreground text-xs">Projet (facultatif)</p>
                <Select value={bdProjet} onValueChange={(v) => setBdProjet(v ?? '__tous__')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__tous__">Tous les projets</SelectItem>
                    {projets.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.libelle} [{p.code}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => chargerBaseBd(sourceMode as 'beneficiaires' | 'structures')}
                disabled={chargement}
              >
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FlaskConical className="size-4" />
                )}
                Charger {sourceMode === 'structures' ? 'les structures' : 'les bénéficiaires'}
              </Button>
            </div>
          )}

          {sourceMode === 'enquete' && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <Select value={indicateur} onValueChange={(v) => setIndicateur(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un indicateur…" />
                  </SelectTrigger>
                  <SelectContent>
                    {indicateurs.map((i) => (
                      <SelectItem key={i.code} value={i.code}>
                        {i.libelle} [{i.code}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={charger} disabled={!indicateur || chargement}>
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FlaskConical className="size-4" />
                )}
                Charger
              </Button>
            </div>
          )}

          {sourceMode === 'fichier' && (
            <div className="flex flex-wrap items-end gap-3">
              <input
                type="file"
                accept=".sav,.xlsx,.xls,.ods,.csv,.tsv,.tab,.json,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFichier(f);
                  setRefFichierChoisi(f?.name ?? '');
                  // Nouveau fichier : on oublie le sélecteur de feuilles précédent.
                  setFichierPath(null);
                  setFeuilles([]);
                  setFeuilleSel(null);
                }}
                className="file:border-input file:bg-background text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
              />
              <Button onClick={chargerFichier} disabled={!fichier || chargement}>
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Importer et analyser
              </Button>
              {feuilles.length > 1 && (
                <div className="min-w-56 space-y-1">
                  <p className="text-muted-foreground text-xs">
                    Feuille du classeur ({feuilles.length})
                  </p>
                  <Select
                    value={feuilleSel ?? feuilles[0]}
                    onValueChange={(v) => v && changerFeuille(v)}
                    disabled={chargement}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {feuilles.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          {sourceMode === 'fichier' && feuilles.length > 1 && (
            <p className="text-muted-foreground mt-2 text-xs">
              Classeur multi-feuilles : l’en-tête est détecté automatiquement (les préambules Kobo /
              CSPro sont ignorés). Changez de feuille ci-dessus pour analyser un autre onglet.
            </p>
          )}

          {sourceMode === 'multi' && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <p className="text-muted-foreground text-xs">
                Analyse mensuelle : empile les réponses d’un indicateur sur plusieurs projets. Les
                colonnes <strong>Projet</strong> et <strong>Programme stratégique</strong> sont
                ajoutées pour croiser les résultats par projet ou par programme.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Programme stratégique</p>
                  <Select
                    value={mpProgramme}
                    onValueChange={(v) => {
                      setMpProgramme(v ?? '__tous__');
                      setMpProjets([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__tous__">Tous (transversal)</SelectItem>
                      {programmes.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Indicateur / questionnaire</p>
                  <Select value={mpIndicateur} onValueChange={(v) => setMpIndicateur(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un indicateur…" />
                    </SelectTrigger>
                    <SelectContent>
                      {indicateurs.map((i) => (
                        <SelectItem key={i.code} value={i.code}>
                          {i.libelle} [{i.code}]
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Projets ({mpProjets.length > 0 ? `${mpProjets.length} sélectionné(s)` : 'tous'})
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setMpProjets(projetsProgramme.map((p) => p.code))}
                    >
                      Tout
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setMpProjets([])}
                    >
                      Aucun
                    </Button>
                  </div>
                </div>
                <div className="grid max-h-36 grid-cols-1 gap-1 overflow-auto rounded border p-2 sm:grid-cols-2">
                  {projetsProgramme.map((p) => (
                    <label key={p.code} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={mpProjets.includes(p.code)}
                        onCheckedChange={() =>
                          setMpProjets((prev) =>
                            prev.includes(p.code)
                              ? prev.filter((c) => c !== p.code)
                              : [...prev, p.code],
                          )
                        }
                      />
                      <span className="truncate" title={p.libelle}>
                        {p.libelle}
                      </span>
                    </label>
                  ))}
                  {projetsProgramme.length === 0 && (
                    <p className="text-muted-foreground text-xs italic">
                      Aucun projet actif pour ce programme.
                    </p>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Aucun projet coché = tous les projets du programme sélectionné.
                </p>
              </div>

              <Button onClick={chargerMultiProjets} disabled={!mpIndicateur || chargement}>
                {chargement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Layers className="size-4" />
                )}
                Charger la base multi-projets
              </Button>
            </div>
          )}

          {/* Détection automatique d'un jeu de données / projet DÉJÀ importé. */}
          {dossierDoublon && !baseEpuree && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="flex items-center gap-2">
                <FolderOpen className="size-4 shrink-0" />
                <span>
                  «&nbsp;{dossierDoublon.label}&nbsp;» a déjà été importé —{' '}
                  {dossierDoublon.jobs.length} traitement(s) dans l’archive. Ouvrez son dossier pour
                  poursuivre votre travail.
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => ouvrirDossier(dossierDoublon.cle)}
              >
                Ouvrir le dossier
              </Button>
            </div>
          )}

          {analyse && (
            <Badge variant="secondary">
              {datasetRef ? fichierNom : `${analyse.n_rows} réponses`} · {analyse.n_rows} lignes ·{' '}
              {variables.length} variables
            </Badge>
          )}
        </CardContent>
      </Card>

      {erreur && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {erreur}
        </div>
      )}

      {/* Espace d'analyse — rail des commandes (façon DataStudio desktop) + panneau */}
      {analyse?.corruption?.corrompu && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            Caractères déjà perdus dans le fichier source (encodage)
          </p>
          <p className="mt-1.5">
            Cette base contient des caractères remplacés par «&nbsp;?&nbsp;» — signe que le fichier
            a été exporté dans un encodage non-Unicode. Ces caractères (souvent vietnamien, khmer,
            arabe, mandarin…) sont perdus <strong>avant l’import</strong> : la traduction ne peut
            pas les restaurer. Pour les récupérer, ré-exportez la source en <strong>UTF-8</strong>{' '}
            (SPSS : Enregistrer sous → Unicode UTF-8 ; Kobo : export CSV/XLSX, nativement UTF-8),
            puis ré-importez.
          </p>
          {analyse.corruption.exemples.length > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              Exemples repérés : {analyse.corruption.exemples.slice(0, 4).join(' · ')}
            </p>
          )}
        </div>
      )}

      {analyse && source && (
        <Tabs
          value={ongletActif}
          onValueChange={setOngletActif}
          orientation="vertical"
          className="grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]"
        >
          <div className="space-y-3 md:sticky md:top-4">
            <div className="bg-muted/40 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium">Jeu de données</p>
              <p className="mt-1 truncate text-sm font-semibold" title={sourceLabel}>
                {sourceLabel}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {analyse.n_rows} lignes · {variables.length} variables
              </p>
            </div>
            <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
              <p className="text-muted-foreground px-1 pt-1 text-[10px] font-semibold tracking-wider uppercase">
                Données
              </p>
              <TabsTrigger value="brute" className="w-full justify-start gap-2">
                <FileStack className="size-4" /> Base brute
              </TabsTrigger>
              <TabsTrigger value="specs" className="w-full justify-start gap-2">
                <ClipboardList className="size-4" /> Caractéristiques
              </TabsTrigger>
              <TabsTrigger value="diag" className="w-full justify-start gap-2">
                <Gauge className="size-4" /> Diagnostic
              </TabsTrigger>
              <TabsTrigger value="anomalies" className="w-full justify-start gap-2">
                <AlertTriangle className="size-4" /> Anomalies
              </TabsTrigger>
              <TabsTrigger value="filtres" className="w-full justify-start gap-2">
                <Filter className="size-4" /> Filtres
                {filtres.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {filtres.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="conso" className="w-full justify-start gap-2">
                <Layers className="size-4" /> Consolidation
                {consolide && (
                  <Badge variant="secondary" className="ml-auto">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="clean" className="w-full justify-start gap-2">
                <Wand2 className="size-4" /> Nettoyage
              </TabsTrigger>
              <TabsTrigger value="trad" className="w-full justify-start gap-2">
                <Languages className="size-4" /> Traduction
                {traduit && (
                  <Badge variant="secondary" className="ml-auto">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <p className="text-muted-foreground px-1 pt-2 text-[10px] font-semibold tracking-wider uppercase">
                Analyses
              </p>
              <TabsTrigger value="freq" className="w-full justify-start gap-2">
                <Sigma className="size-4" /> Tris à plat
              </TabsTrigger>
              <TabsTrigger value="cross" className="w-full justify-start gap-2">
                <Table2 className="size-4" /> Croisements
              </TabsTrigger>
              <TabsTrigger value="stat" className="w-full justify-start gap-2">
                <Sparkles className="size-4" /> Tests statistiques
              </TabsTrigger>
              <TabsTrigger value="multi" className="w-full justify-start gap-2">
                <ListChecks className="size-4" /> Réponses multiples
              </TabsTrigger>
              <TabsTrigger value="graph" className="w-full justify-start gap-2">
                <BarChart3 className="size-4" /> Graphiques
              </TabsTrigger>
              <TabsTrigger value="liste" className="w-full justify-start gap-2">
                <ListOrdered className="size-4" /> Liste
              </TabsTrigger>
              <p className="text-muted-foreground px-1 pt-2 text-[10px] font-semibold tracking-wider uppercase">
                Restitution
              </p>
              <TabsTrigger value="rapport" className="w-full justify-start gap-2">
                <FileText className="size-4" /> Rapport
              </TabsTrigger>
              <p className="text-muted-foreground px-1 pt-2 text-[10px] font-semibold tracking-wider uppercase">
                Aide
              </p>
              <TabsTrigger value="guide" className="w-full justify-start gap-2">
                <BookOpen className="size-4" /> Guide
              </TabsTrigger>
              <TabsTrigger value="method" className="w-full justify-start gap-2">
                <ScrollText className="size-4" /> Méthodologie
              </TabsTrigger>
            </TabsList>
            <Separator />
            <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
              Exporter
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!aDesResultats}
              onClick={() =>
                exporter(() =>
                  exporterGlobalExcel({
                    freq,
                    cross,
                    multi,
                    stat,
                    statRow,
                    statCol,
                    libelle: libelleVariable,
                    nomFichier: `export_global_${nomSur(sourceRef || 'datastudio')}.xlsx`,
                  }),
                )
              }
            >
              <Download className="size-4" /> Excel global
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!aDesResultats && !rapport}
              onClick={() =>
                exporter(() =>
                  exporterResultatsWord({
                    freq,
                    cross,
                    multi,
                    stat,
                    statRow,
                    statCol,
                    rapport,
                    libelle: libelleVariable,
                    source: sourceLabel,
                    nomFichier: `rapport_analyse_${nomSur(sourceRef || 'datastudio')}.docx`,
                  }),
                )
              }
            >
              <FileText className="size-4" /> Word documenté
            </Button>
          </div>

          {/* --- Tris à plat --- */}
          <TabsContent value="freq" className="mt-0 space-y-4">
            {renderFiltreInline()}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tris à plat</CardTitle>
                <CardDescription>
                  Choisissez les variables à analyser. Recherchez, filtrez par type de mesure ou
                  sélectionnez en masse. Les variables techniques (identifiants, métadonnées) sont
                  décochées par défaut.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <VariablePicker variables={variables} selected={varsSel} onChange={setVarsSel} />
                <Separator />
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={exclure} onCheckedChange={setExclure} />
                    Exclure les valeurs manquantes
                  </label>
                  <Button onClick={lancerFreq} disabled={busyFreq || varsSel.length === 0}>
                    {busyFreq && <Loader2 className="size-4 animate-spin" />}
                    Produire les tris à plat ({varsSel.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1"
                    disabled={!freq}
                    onClick={() => freq && exporter(() => exporterFreqExcel(freq, libelleVariable))}
                  >
                    <Download className="size-4" /> Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {freq &&
              Object.entries(freq.tables).map(([name, rows]) => {
                const chartData = rows
                  .filter((r) => r.Modalité !== 'Total' && r.Modalité !== '[Manquant]')
                  .map((r) => ({ modalite: r.Modalité, effectif: r.Effectif }));
                return (
                  <Card key={name}>
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{libelleVariable(name)}</CardTitle>
                        <CardDescription className="font-mono text-xs">{name}</CardDescription>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            telechargerFichier(
                              `tri_a_plat_${nomSur(name)}.csv`,
                              versCsv(rows as unknown as Record<string, unknown>[]),
                            )
                          }
                        >
                          <Download className="size-4" /> CSV
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            exporter(() =>
                              exporterFreqTableExcel(
                                name,
                                libelleVariable(name),
                                rows,
                                `tri_a_plat_${nomSur(name)}.xlsx`,
                              ),
                            )
                          }
                        >
                          <Download className="size-4" /> Excel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            exporter(() => exporterFreqTableWord(libelleVariable(name), name, rows))
                          }
                        >
                          <FileText className="size-4" /> Word
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Modalité</TableHead>
                            <TableHead className="text-right">Effectif</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead className="text-right">% valide</TableHead>
                            <TableHead className="text-right">% cumulé</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, idx) => (
                            <TableRow
                              key={idx}
                              className={r.Modalité === 'Total' ? 'font-semibold' : ''}
                            >
                              <TableCell>{r.Modalité}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.Effectif}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['%'])}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['% valide'])}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['% cumulé'])}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="modalite"
                              tick={{ fontSize: 11 }}
                              interval={0}
                              angle={-20}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip {...tooltipPropsPremium} />
                            <Bar dataKey="effectif" radius={[4, 4, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell key={i} fill={couleurRang(i)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* --- Croisements --- */}
          <TabsContent value="cross" className="space-y-4">
            {renderFiltreInline()}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paramètres du croisement</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <SelectChamp label="Lignes" value={row} onChange={setRow} options={variables} />
                <SelectChamp label="Colonnes" value={col} onChange={setCol} options={variables} />
                <SelectChamp
                  label="Couche"
                  value={layer}
                  onChange={setLayer}
                  options={variables}
                  aucune
                />
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Pourcentages</p>
                  <Select
                    value={pctMode}
                    onValueChange={(v) => setPctMode((v ?? 'Ligne') as 'Ligne' | 'Colonne')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ligne">Ligne</SelectItem>
                      <SelectItem value="Colonne">Colonne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={lancerCross} disabled={busyCross || !row || !col}>
                  {busyCross && <Loader2 className="size-4 animate-spin" />}
                  Croiser
                </Button>
                <Button
                  variant="outline"
                  className="gap-1"
                  disabled={!cross}
                  onClick={() =>
                    cross && exporter(() => exporterCrossExcel(cross, libelleVariable))
                  }
                >
                  <Download className="size-4" /> Excel
                </Button>
              </CardContent>
            </Card>

            {cross &&
              cross.layers.map((lyr, li) => (
                <Card key={li}>
                  <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {libelleVariable(cross.row)} × {libelleVariable(cross.col)}
                        {cross.layer ? ` · ${lyr.layer_value}` : ''}
                      </CardTitle>
                      <CardDescription>
                        Base valide : {lyr.base} · pourcentages en {cross.pct_mode.toLowerCase()}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        const lignes = lyr.index.map((idx, ri) => {
                          const row: Record<string, unknown> = { Modalité: idx };
                          lyr.columns.forEach((c, ci) => {
                            row[c] = lyr.counts[ri]?.[ci] ?? 0;
                          });
                          return row;
                        });
                        telechargerFichier(
                          `croisement_${nomSur(cross.row)}_x_${nomSur(cross.col)}.csv`,
                          versCsv(lignes, ['Modalité', ...lyr.columns]),
                        );
                      }}
                    >
                      <Download className="size-4" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modalité</TableHead>
                          {lyr.columns.map((c) => (
                            <TableHead key={c} className="text-right">
                              {c}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lyr.index.map((idx, ri) => (
                          <TableRow key={idx} className={idx === 'Total' ? 'font-semibold' : ''}>
                            <TableCell>{idx}</TableCell>
                            {lyr.columns.map((c, ci) => {
                              const eff = lyr.counts[ri]?.[ci] ?? 0;
                              const p = lyr.pct[ri]?.[ci] ?? null;
                              return (
                                <TableCell key={c} className="text-right tabular-nums">
                                  {eff}
                                  {p !== null && p !== undefined && (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      ({(p * 100).toFixed(1)} %)
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          {/* --- Tests statistiques (Khi² / Welch) --- */}
          <TabsContent value="stat" className="space-y-4">
            {renderFiltreInline()}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tests statistiques</CardTitle>
                <CardDescription>
                  Khi² d’indépendance entre deux variables, et t-test de Welch lorsqu’une variable
                  d’échelle est croisée à une variable à exactement 2 modalités. Valeurs manquantes
                  exclues, seuil de 5 %.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <SelectChamp
                  label="Variable 1"
                  value={statRow}
                  onChange={setStatRow}
                  options={variables}
                />
                <SelectChamp
                  label="Variable 2"
                  value={statCol}
                  onChange={setStatCol}
                  options={variables}
                />
                <Button
                  onClick={lancerStat}
                  disabled={busyStat || !statRow || !statCol || statRow === statCol}
                >
                  {busyStat ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Lancer les tests
                </Button>
              </CardContent>
            </Card>

            {stat && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Khi² d’indépendance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stat.chi_square.applicable ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">χ² = {stat.chi_square.chi2.toFixed(3)}</Badge>
                          <Badge variant="secondary">ddl = {stat.chi_square.dof}</Badge>
                          <Badge variant="secondary">p = {stat.chi_square.p.toFixed(4)}</Badge>
                          <Badge variant={stat.chi_square.significatif ? 'default' : 'outline'}>
                            {stat.chi_square.significatif ? 'Significatif' : 'Non significatif'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{stat.chi_square.message}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {stat.chi_square.message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">t-test de Welch</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stat.welch_ttest.applicable ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">t = {stat.welch_ttest.t.toFixed(3)}</Badge>
                          <Badge variant="secondary">p = {stat.welch_ttest.p.toFixed(4)}</Badge>
                          <Badge variant={stat.welch_ttest.significatif ? 'default' : 'outline'}>
                            {stat.welch_ttest.significatif ? 'Significatif' : 'Non significatif'}
                          </Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Groupe</TableHead>
                              <TableHead className="text-right">Moyenne</TableHead>
                              <TableHead className="text-right">n</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stat.welch_ttest.groups.map((g) => (
                              <TableRow key={g.nom}>
                                <TableCell>{g.nom}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {g.moyenne.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{g.n}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <p className="text-muted-foreground text-sm">{stat.welch_ttest.message}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {stat.welch_ttest.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* --- Réponses multiples --- */}
          <TabsContent value="multi" className="space-y-4">
            {renderFiltreInline()}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions à réponses multiples</CardTitle>
                <CardDescription>
                  Détection automatique des batteries de variables binaires (0/1) partageant un même
                  intitulé. Le total des pourcentages peut dépasser 100 % (plusieurs réponses par
                  répondant).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={lancerMulti} disabled={busyMulti}>
                    {busyMulti ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ListChecks className="size-4" />
                    )}
                    Analyser les réponses multiples
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1"
                    disabled={!multi || Object.keys(multi.tables).length === 0}
                    onClick={() => multi && exporter(() => exporterMultiExcel(multi))}
                  >
                    <Download className="size-4" /> Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {multi && Object.keys(multi.tables).length === 0 && (
              <p className="text-muted-foreground text-sm italic">
                Aucune batterie de réponses multiples détectée dans ce jeu de données.
              </p>
            )}

            {multi &&
              Object.entries(multi.tables).map(([prefix, table]) => {
                const chartData = table.rows
                  .filter((r) => r.Option !== 'Total répondants valides')
                  .map((r) => ({ option: r.Option, effectif: r.Effectif }));
                return (
                  <Card key={prefix}>
                    <CardHeader>
                      <CardTitle className="text-base">{prefix}</CardTitle>
                      <CardDescription>Base valide : {table.base} répondant(s)</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Option</TableHead>
                            <TableHead className="text-right">Effectif</TableHead>
                            <TableHead className="text-right">% répondants</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {table.rows.map((r, idx) => (
                            <TableRow
                              key={idx}
                              className={
                                r.Option === 'Total répondants valides' ? 'font-semibold' : ''
                              }
                            >
                              <TableCell>{r.Option}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.Effectif}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {pct(r['Pourcentage répondants'])}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="option"
                              tick={{ fontSize: 11 }}
                              interval={0}
                              angle={-20}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip {...tooltipPropsPremium} />
                            <Bar dataKey="effectif" radius={[4, 4, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell key={i} fill={couleurRang(i)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* --- Nettoyage / épuration --- */}
          <TabsContent value="conso" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consolidation multilingue</CardTitle>
                <CardDescription>
                  Quand un questionnaire est <strong>dupliqué par langue</strong> avant
                  l’administration (le répondant ne remplit que le bloc de SA langue), une même
                  question apparaît en plusieurs colonnes (ex. <code>sexe</code>,{' '}
                  <code>sexe_kh</code>, <code>sexe_viet</code>) et chaque ligne comporte de longues
                  séries de vides « par construction » — ce qui fait échouer le nettoyage. La
                  consolidation <strong>fusionne ces variantes en une seule variable</strong> (la
                  valeur non vide de la langue du répondant), pour obtenir un questionnaire unique
                  avec les réponses des différentes langues empilées. Le regroupement détecté est{' '}
                  <strong>affiché et validé AVANT</strong> d’être appliqué.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!analyse ? (
                  <p className="text-muted-foreground text-sm italic">
                    Chargez d’abord une base (onglet Source) pour la consolider.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={detecterConsolidation}
                        disabled={busyConso}
                      >
                        {busyConso ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        Détecter les groupes
                      </Button>
                      <Button onClick={appliquerConsolidation} disabled={busyConso || !consoPlan}>
                        {busyConso ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Layers className="size-4" />
                        )}
                        Consolider
                      </Button>
                    </div>

                    {consoPlan && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">{consoPlan.n_variables} variables</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="secondary">
                          {consoPlan.n_variables_apres} après consolidation
                        </Badge>
                        <Badge variant="secondary">{consoPlan.plan.length} groupe(s)</Badge>
                        {consoPlan.orphelins.length > 0 && (
                          <Badge variant="secondary">
                            {consoPlan.orphelins.length} orphelin(s)
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Groupes détectés : cochés = à fusionner. */}
                    {consoPlan && consoPlan.plan.length > 0 && (
                      <div className="space-y-2 rounded-md border border-dashed p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Groupes détectés — {consoPlan.plan.length}
                          </p>
                          <button
                            type="button"
                            className="text-xs text-[#0E4F88] hover:underline"
                            onClick={() =>
                              setConsoGroupesSel((prev) =>
                                prev.size === consoPlan.plan.length
                                  ? new Set()
                                  : new Set(consoPlan.plan.map((g) => g.canonical)),
                              )
                            }
                          >
                            {consoGroupesSel.size === consoPlan.plan.length
                              ? 'Tout décocher'
                              : 'Tout cocher'}
                          </button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Décochez un groupe pour laisser ses colonnes séparées. La variable finale
                          (en gras) conserve les libellés de la base.
                        </p>
                        <div className="max-h-72 space-y-1 overflow-auto">
                          {consoPlan.plan.map((g) => (
                            <label
                              key={g.canonical}
                              className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 size-4 shrink-0"
                                checked={consoGroupesSel.has(g.canonical)}
                                onChange={(e) =>
                                  setConsoGroupesSel((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(g.canonical);
                                    else next.delete(g.canonical);
                                    return next;
                                  })
                                }
                              />
                              <span className="min-w-0">
                                <span className="font-semibold">{g.canonical}</span>
                                {g.label && g.label !== g.canonical && (
                                  <span className="text-muted-foreground"> — {g.label}</span>
                                )}
                                <span className="text-muted-foreground block truncate text-xs">
                                  fusionne : {g.variants.join(', ')}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Orphelins : variantes non rattachées → base à choisir. */}
                    {consoPlan && consoPlan.orphelins.length > 0 && (
                      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                          Variantes à rattacher manuellement — {consoPlan.orphelins.length}
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-400">
                          Ces colonnes-variantes n’ont pas pu être rattachées automatiquement
                          (libellés dans des langues différentes). Choisissez leur variable de
                          destination, ou « Ignorer » pour les laisser telles quelles.
                        </p>
                        <div className="space-y-2">
                          {consoPlan.orphelins.map((o) => (
                            <div
                              key={o.variant}
                              className="flex flex-wrap items-center gap-2 text-sm"
                            >
                              <span className="font-mono text-xs">{o.variant}</span>
                              <span className="text-muted-foreground">→</span>
                              <Select
                                value={consoOrphelins[o.variant] || '__ignorer__'}
                                onValueChange={(v) =>
                                  setConsoOrphelins((prev) => ({
                                    ...prev,
                                    [o.variant]: v && v !== '__ignorer__' ? v : '',
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 w-64">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__ignorer__">
                                    Ignorer (garder séparé)
                                  </SelectItem>
                                  {variables
                                    .filter((v) => v.name !== o.variant)
                                    .map((v) => (
                                      <SelectItem key={v.name} value={v.name}>
                                        {v.name}
                                        {v.display && v.display !== v.name ? ` — ${v.display}` : ''}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {consoPlan &&
                      consoPlan.plan.length === 0 &&
                      consoPlan.orphelins.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                          Aucune colonne-variante de langue détectée : cette base n’a pas besoin
                          d’être consolidée.
                        </p>
                      )}

                    <p className="text-muted-foreground text-xs">
                      La consolidation remplace la base de travail : tous les traitements suivants
                      (nettoyage, traduction, analyses) portent sur la base consolidée, retrouvée à
                      l’identique en rouvrant un traitement depuis l’historique.
                    </p>

                    {consolide && consoInfo && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Layers className="size-4" />
                        <span>Base consolidée active.</span>
                        <Badge variant="secondary">{consoInfo.nApres} variables</Badge>
                        <Badge variant="secondary">
                          {consoInfo.nFusionnees} colonne(s) fusionnée(s)
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trad" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traduction assistée par IA</CardTitle>
                <CardDescription>
                  Pour les enquêtes en <strong>langue étrangère</strong> (vietnamien, khmer,
                  portugais, mandarin, japonais…). L’IA détecte la langue puis traduit les{' '}
                  <strong>en-têtes de colonnes</strong> et les <strong>modalités</strong> (valeurs
                  catégorielles) vers la langue cible, afin que la suite — nettoyage, croisements,
                  rapport — se fasse dans cette langue. Le sens d’origine est préservé : les valeurs
                  hors table (texte libre, noms propres, nombres) restent inchangées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!analyse ? (
                  <p className="text-muted-foreground text-sm italic">
                    Chargez d’abord une base (onglet Source) pour la traduire.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-56 space-y-1">
                        <p className="text-muted-foreground text-xs">Langue cible</p>
                        <Select
                          value={langueCible}
                          onValueChange={(v) => setLangueCible(v ?? 'Français')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe'].map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" onClick={detecterTraduction} disabled={busyTrad}>
                        {busyTrad ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        Détecter
                      </Button>
                      <Button onClick={appliquerTraduction} disabled={busyTrad}>
                        {busyTrad ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Languages className="size-4" />
                        )}
                        Traduire vers {langueCible}
                      </Button>
                    </div>

                    {progressTrad && (
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="size-3 animate-spin" /> {progressTrad}
                      </p>
                    )}

                    {/* Réponses ouvertes détectées : sélection à traduire par lots. */}
                    {termesTraduction && colonnesOuvertes.length > 0 && (
                      <div className="space-y-2 rounded-md border border-dashed p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Réponses ouvertes (texte libre) — {colonnesOuvertes.length} colonne(s)
                          </p>
                          <button
                            type="button"
                            className="text-xs text-[#0E4F88] hover:underline"
                            onClick={() =>
                              setOuvertesSel((prev) =>
                                prev.size === colonnesOuvertes.length
                                  ? new Set()
                                  : new Set(colonnesOuvertes),
                              )
                            }
                          >
                            {ouvertesSel.size === colonnesOuvertes.length
                              ? 'Tout décocher'
                              : 'Tout cocher'}
                          </button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Cochez les colonnes de verbatims / commentaires à traduire. Le texte
                          d’origine est conservé dans une colonne « (VO) » qui n’entre PAS dans les
                          analyses ni les rapports.
                        </p>
                        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
                          {colonnesOuvertes.map((col) => (
                            <label
                              key={col}
                              className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="size-4"
                                checked={ouvertesSel.has(col)}
                                onChange={(e) =>
                                  setOuvertesSel((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(col);
                                    else next.delete(col);
                                    return next;
                                  })
                                }
                              />
                              <span className="truncate" title={col}>
                                {col}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {termesTraduction && colonnesOuvertes.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        Aucune colonne de réponses ouvertes détectée : seuls les en-têtes et les
                        modalités seront traduits.
                      </p>
                    )}

                    <p className="text-muted-foreground text-xs">
                      La traduction remplace la base de travail : tous les traitements suivants
                      portent sur la base traduite, retrouvée à l’identique en rouvrant le
                      traitement depuis l’historique. Seuls les termes (en-têtes, modalités,
                      réponses ouvertes cochées) sont envoyés à l’IA — jamais la base entière.
                    </p>
                    {traduit && traductionInfo && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Languages className="size-4" />
                        <span>
                          Base traduite active
                          {traductionInfo.langueDetectee
                            ? ` — depuis « ${traductionInfo.langueDetectee} »`
                            : ''}{' '}
                          vers <strong>{traductionInfo.langueCible}</strong>.
                        </span>
                        <Badge variant="secondary">{traductionInfo.nbColonnes} en-tête(s)</Badge>
                        <Badge variant="secondary">{traductionInfo.nbValeurs} valeur(s)</Badge>
                        {(traductionInfo.nbOuvertes ?? 0) > 0 && (
                          <Badge variant="secondary">
                            {traductionInfo.nbOuvertes} réponse(s) ouverte(s)
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clean" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nettoyage de la base</CardTitle>
                <CardDescription>
                  Deux familles d’opérations, distinctes et activables séparément :{' '}
                  <strong>① les corrections</strong> (elles <em>ne retirent aucune ligne</em> :
                  espaces, codes d’absence, arrondis) et <strong>② l’épuration</strong> (elle
                  <em> retire des lignes</em> : vides, sans clé, incomplètes, doublons). Chaque
                  passage produit un <strong>résumé</strong> détaillant ce qui a été corrigé et
                  retiré.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ① Corrections — ne retirent AUCUNE ligne, corrigent les valeurs. */}
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-semibold">
                    ① Corrections{' '}
                    <span className="text-muted-foreground font-normal">
                      — sans retirer de lignes
                    </span>
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={normMissing} onCheckedChange={setNormMissing} />
                      Normaliser les valeurs manquantes{' '}
                      <span className="text-muted-foreground text-xs">
                        (codes d’absence « NSP », « 99 »… → vide)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={trimEspaces} onCheckedChange={setTrimEspaces} />
                      Retirer les espaces superflus (texte)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={arrondir} onCheckedChange={setArrondir} />
                      Arrondir les variables numériques (décimales cibles)
                    </label>
                  </div>
                </div>

                {/* ② Épuration — retrait de lignes (vides, clés, incomplètes, doublons). */}
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-semibold">
                    ② Épuration{' '}
                    <span className="text-muted-foreground font-normal">— retrait de lignes</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={dropEmpty} onCheckedChange={setDropEmpty} />
                      Retirer les lignes entièrement vides
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={dropDuplicates} onCheckedChange={setDropDuplicates} />
                      Retirer les doublons
                    </label>
                  </div>

                  {/* Épuration CIBLÉE : on ne retire que les lignes auxquelles il
                      manque une information jugée obligatoire (nom, contact…). */}
                  <div className="space-y-2 rounded-md border border-dashed p-3">
                    <p className="text-sm font-medium">
                      Variables obligatoires{' '}
                      <span className="text-muted-foreground font-normal">
                        — une ligne est retirée uniquement si l’une d’elles est vide
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Sélectionnez les informations indispensables à l’analyse (ex. nom, prénom,
                      contact, pays…). Les lignes complètes sur ces variables sont conservées, même
                      s’il leur manque des informations secondaires. Laissez vide pour ne rien
                      retirer sur ce critère.
                    </p>
                    {analyse ? (
                      <VariablePicker
                        variables={variables}
                        selected={keyCols}
                        onChange={setKeyCols}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        Chargez une base pour choisir les variables obligatoires.
                      </p>
                    )}
                    <label className="flex items-center gap-2 pt-1 text-sm">
                      <Switch checked={dropMissing} onCheckedChange={setDropMissing} />
                      <span>
                        Ne garder que les lignes <strong>100 % complètes</strong>
                        <span className="text-muted-foreground">
                          {' '}
                          (retire toute ligne à laquelle il manque une valeur, sur n’importe quelle
                          variable — à utiliser avec prudence)
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={lancerClean} disabled={busyClean}>
                    {busyClean ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    Aperçu du nettoyage
                  </Button>
                  <Button onClick={appliquerBaseEpuree} disabled={busyClean}>
                    {busyClean ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Adopter &amp; enregistrer la base nettoyée
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  « Aperçu » ne modifie pas la base. « Adopter » remplace la base de travail par la
                  base nettoyée : tous les traitements suivants (tris, liste, rapport…) portent
                  alors sur cette base, et elle est retrouvée à l’identique en rouvrant le
                  traitement depuis l’historique.
                </p>
                {baseEpuree && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Wand2 className="size-4" />
                    Base de travail active : <strong>base nettoyée</strong>.
                  </div>
                )}
              </CardContent>
            </Card>

            {clean && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Résumé du nettoyage</CardTitle>
                  <CardDescription>
                    <span className="inline-flex flex-wrap gap-2">
                      <Badge variant="secondary">Source : {clean.n_rows_source} lignes</Badge>
                      <Badge variant="secondary">Nettoyée : {clean.n_rows_cleaned} lignes</Badge>
                      <Badge variant={clean.n_removed > 0 ? 'default' : 'outline'}>
                        {clean.n_removed} retirée(s)
                      </Badge>
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clean.rapport && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* ① Ce qui a été corrigé (aucune ligne retirée) */}
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-sm font-semibold">① Corrections</p>
                        <ul className="text-muted-foreground space-y-0.5 text-xs">
                          <li>
                            Valeurs manquantes normalisées :{' '}
                            <strong className="text-foreground">
                              {clean.rapport.corrections.codes_manquants_normalises}
                            </strong>{' '}
                            cellule(s)
                          </li>
                          <li>
                            Espaces superflus retirés :{' '}
                            <strong className="text-foreground">
                              {clean.rapport.corrections.espaces_nettoyes}
                            </strong>{' '}
                            cellule(s)
                          </li>
                          <li>
                            Variables arrondies :{' '}
                            <strong className="text-foreground">
                              {clean.rapport.corrections.colonnes_arrondies}
                            </strong>
                          </li>
                        </ul>
                      </div>
                      {/* ② Ce qui a été retiré, par motif */}
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-sm font-semibold">
                          ② Épuration — {clean.rapport.n_retirees} ligne(s) retirée(s)
                        </p>
                        {clean.rapport.retraits.length === 0 ? (
                          <p className="text-muted-foreground text-xs italic">
                            Aucun retrait (épuration désactivée).
                          </p>
                        ) : (
                          <ul className="text-muted-foreground space-y-0.5 text-xs">
                            {clean.rapport.retraits.map((r) => (
                              <li key={r.motif}>
                                {r.motif} : <strong className="text-foreground">{r.n}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                  {clean.preview.length > 0 ? (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Aperçu des {Math.min(clean.preview.length, 100)} premières lignes nettoyées.
                      </p>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {clean.specs.map((s) => (
                                <TableHead key={s.name} title={`${s.measure}`}>
                                  {s.name}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clean.preview.slice(0, 20).map((r, ri) => (
                              <TableRow key={ri}>
                                {clean.specs.map((s) => (
                                  <TableCell key={s.name} className="tabular-nums">
                                    {String(r[s.name] ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {clean.preview.length > 20 && (
                        <p className="text-muted-foreground text-xs italic">
                          20 lignes affichées sur {clean.preview.length} de l’aperçu.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      La base nettoyée ne contient aucune ligne.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Rapport (API Claude) --- */}
          <TabsContent value="rapport" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Générer un rapport</CardTitle>
                <CardDescription>
                  Claude rédige un rapport structuré et illustré (tableaux + graphiques) à partir
                  des résultats. Si aucune analyse n’a encore été produite, les tris à plat
                  nécessaires sont calculés automatiquement en arrière-plan sur la base active. Les
                  chiffres ne sont ni inventés ni recalculés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Format</p>
                    <Select
                      value={formatRapport}
                      onValueChange={(v) => setFormatRapport((v ?? 'synthese') as FormatRapport)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMATS_RAPPORT).map(([key, f]) => (
                          <SelectItem key={key} value={key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={lancerRapport} disabled={busyRapport || !peutGenererRapport}>
                    {busyRapport ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    Générer le rapport
                  </Button>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Structure / axes du rapport{' '}
                    <span className="text-muted-foreground font-normal">
                      {formatRapport === 'personnalise' ? '(requis)' : '(facultatif)'}
                    </span>
                  </p>
                  <Textarea
                    value={structureLibre}
                    onChange={(e) => setStructureLibre(e.target.value)}
                    placeholder={
                      'Décrivez librement le plan / les axes à mettre en avant. Ex. : mettre en avant les ' +
                      'résultats liés aux activités menées, à l’acquisition des compétences, à leur utilisation, ' +
                      'aux effets induits / retombées après utilisation, puis un florilège de témoignages concrets…'
                    }
                    rows={4}
                  />
                  <p className="text-muted-foreground text-xs">
                    L’IA suivra cette structure comme plan du rapport (et l’illustrera de tableaux
                    et de graphiques).
                  </p>
                </div>

                {/* « Plus de précision » : à partir de la demande de l'utilisateur
                    (structure / axes), l'IA pose des questions pour mieux cadrer le
                    rapport — et rien si la demande est déjà claire. */}
                <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Plus de précision</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clarifier}
                      disabled={busyClar || !structureLibre.trim()}
                    >
                      {busyClar ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {clarFaite ? 'Réanalyser ma demande' : 'Plus de précision'}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    À partir de votre demande ci-dessus (structure / axes), l’IA vérifie si elle est
                    assez claire. Si besoin, elle vous pose quelques questions pour mieux structurer
                    le rapport — sinon, elle n’en pose aucune.{' '}
                    {!structureLibre.trim() && 'Renseignez d’abord la structure / les axes.'}
                  </p>

                  {/* Fichier modèle / ressource joint */}
                  <div className="space-y-1">
                    {modeleFichier ? (
                      <div className="flex items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm dark:bg-slate-900">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">Modèle joint : {modeleFichier.nom}</span>
                        </span>
                        <button
                          type="button"
                          aria-label="Retirer le modèle"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setModeleFichier(null)}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <span className="border-input hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5">
                          {busyModele ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          Joindre un fichier (modèle / ressource)
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,.md,.csv"
                          className="hidden"
                          disabled={busyModele}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) joindreModele(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Trame, rapport-type ou ressource (PDF, Word, texte) : l’IA s’en inspire pour
                      la présentation, sans en tirer de chiffres.
                    </p>
                  </div>

                  {suggestionClar && (
                    <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      💡 {suggestionClar}
                    </p>
                  )}
                  {clarFaite && questionsClar.length === 0 && (
                    <p className="text-muted-foreground text-sm italic">
                      Votre demande est claire : vous pouvez générer le rapport.
                    </p>
                  )}
                  {questionsClar.map((q, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-sm font-medium">
                        {i + 1}. {q}
                      </p>
                      <Textarea
                        value={reponsesClar[i] ?? ''}
                        onChange={(e) =>
                          setReponsesClar((prev) => ({ ...prev, [i]: e.target.value }))
                        }
                        placeholder="Votre réponse…"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>

                <Textarea
                  value={consignes}
                  onChange={(e) => setConsignes(e.target.value)}
                  placeholder="Consignes complémentaires (optionnel) : angle, public visé, longueur…"
                  rows={2}
                />

                {documentsReference.length > 0 && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Documents de référence (cadrage projet / programme)
                      </p>
                      {docsSel.length > 0 && (
                        <Badge variant="secondary">{docsSel.length} sélectionné(s)</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Sélectionnez des documents de la base documentaire : l’IA s’en servira pour le
                      contexte et le cadrage (objectifs, définitions), sans en tirer de chiffres.
                    </p>
                    <div className="grid max-h-40 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
                      {documentsReference.map((d) => (
                        <label key={d.cle} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={docsSel.includes(d.cle)}
                            onCheckedChange={() =>
                              setDocsSel((prev) =>
                                prev.includes(d.cle)
                                  ? prev.filter((c) => c !== d.cle)
                                  : [...prev, d.cle],
                              )
                            }
                          />
                          <span className="truncate" title={`${d.libelle} — ${d.nomFichier}`}>
                            {d.libelle}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-muted-foreground text-xs">
                  Le rapport s’appuie sur TOUS les résultats produits (tris à plat, croisements,
                  réponses multiples, tests). Les chiffres ne sont ni inventés ni recalculés.
                </p>
                {!peutGenererRapport && (
                  <p className="text-muted-foreground text-sm italic">
                    Chargez une base (enquête, fichier ou multi-projets) pour générer un rapport —
                    ou choisissez le format « Rapport personnalisé » et renseignez la structure
                    ci-dessus pour un rapport guidé par votre plan.
                  </p>
                )}
              </CardContent>
            </Card>

            {rapport && (
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">Rapport généré</CardTitle>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigator.clipboard?.writeText(rapport)}
                    >
                      Copier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        exporter(() => exporterRapportPdf(rapport, `Rapport — ${sourceLabel}`))
                      }
                    >
                      <Download className="size-4" /> PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        exporter(() => exporterRapportWord(rapport, `Rapport — ${sourceLabel}`))
                      }
                    >
                      <Download className="size-4" /> Word
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        telechargerFichier(
                          `rapport_${nomSur(sourceRef || 'datastudio')}.md`,
                          rapport,
                          'text/markdown;charset=utf-8;',
                        )
                      }
                    >
                      <Download className="size-4" /> Markdown
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <RapportView markdown={rapport} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Caractéristiques des variables --- */}
          <TabsContent value="specs" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Caractéristiques des variables</CardTitle>
                <CardDescription>
                  Type de mesure inféré (Nominale / Ordinale / Échelle) et nombre de valeurs
                  distinctes (cardinalité) de chaque variable.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variable</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type de mesure</TableHead>
                      <TableHead className="text-right">Cardinalité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variables.map((v) => {
                      const m = MESURES[v.measure];
                      return (
                        <TableRow key={v.name}>
                          <TableCell className="max-w-md truncate" title={v.display}>
                            {v.display}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{v.name}</TableCell>
                          <TableCell>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${m?.classe ?? 'bg-muted text-muted-foreground'}`}
                            >
                              {v.measure}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{v.cardinality}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Diagnostic --- */}
          <TabsContent value="diag" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnostic du jeu de données</CardTitle>
                <CardDescription>
                  Vue d’ensemble technique à partir des métadonnées (volume, types de mesure,
                  variables techniques, batteries de réponses multiples).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const nTech = variables.filter((v) =>
                    estVariableTechnique(v, analyse.n_rows),
                  ).length;
                  const parType = (m: string) => variables.filter((v) => v.measure === m).length;
                  const cardMoy = variables.length
                    ? Math.round(
                        variables.reduce((s, v) => s + v.cardinality, 0) / variables.length,
                      )
                    : 0;
                  const tiles: { valeur: string | number; label: string }[] = [
                    { valeur: analyse.n_rows, label: 'Lignes' },
                    { valeur: variables.length, label: 'Variables' },
                    { valeur: parType('NOMINAL'), label: 'Nominales' },
                    { valeur: parType('ORDINAL'), label: 'Ordinales' },
                    { valeur: parType('ÉCHELLE'), label: 'Échelle' },
                    { valeur: nTech, label: 'Techniques (exclues)' },
                    { valeur: Object.keys(analyse.multi_groups).length, label: 'Batteries multi' },
                    { valeur: cardMoy, label: 'Cardinalité moyenne' },
                  ];
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {tiles.map((t) => (
                        <div key={t.label} className="bg-muted/40 rounded-lg border p-3">
                          <p className="text-2xl font-semibold tabular-nums">{t.valeur}</p>
                          <p className="text-muted-foreground text-xs">{t.label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Graphiques --- */}
          <TabsContent value="graph" className="mt-0 space-y-4">
            {renderFiltreInline()}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Graphiques</CardTitle>
                <CardDescription>
                  Visualisez la répartition d’une variable (barres ou camembert). Les valeurs
                  manquantes sont exclues.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <SelectChamp
                  label="Variable"
                  value={graphVar}
                  onChange={setGraphVar}
                  options={variables}
                />
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Type</p>
                  <Select
                    value={graphType}
                    onValueChange={(v) => setGraphType((v ?? 'barres') as 'barres' | 'camembert')}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="barres">Barres</SelectItem>
                      <SelectItem value="camembert">Camembert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={lancerGraph} disabled={busyGraph || !graphVar}>
                  {busyGraph ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BarChart3 className="size-4" />
                  )}
                  Générer
                </Button>
              </CardContent>
            </Card>

            {graphFreq && graphFreq.tables[graphVar] && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{libelleVariable(graphVar)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const data = graphFreq.tables[graphVar]!.filter(
                      (r) => r.Modalité !== 'Total' && r.Modalité !== '[Manquant]',
                    ).map((r) => ({ modalite: r.Modalité, effectif: r.Effectif }));
                    return (
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {graphType === 'barres' ? (
                            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                dataKey="modalite"
                                tick={{ fontSize: 11 }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={70}
                              />
                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                              <Tooltip {...tooltipPropsPremium} />
                              <Bar dataKey="effectif" radius={[4, 4, 0, 0]}>
                                {data.map((_, i) => (
                                  <Cell key={i} fill={couleurRang(i)} />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : (
                            <PieChart>
                              <Tooltip {...tooltipPropsPremium} />
                              <Legend />
                              <Pie
                                data={data}
                                dataKey="effectif"
                                nameKey="modalite"
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                label
                              >
                                {data.map((_, i) => (
                                  <Cell key={i} fill={couleurRang(i)} />
                                ))}
                              </Pie>
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Base brute --- */}
          <TabsContent value="brute" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">Base brute (aperçu)</CardTitle>
                  <CardDescription>
                    Aperçu des 100 premières lignes (en libellés), filtres appliqués.
                  </CardDescription>
                </div>
                <Button onClick={chargerPreview} disabled={busyPreview} className="shrink-0">
                  {busyPreview ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileStack className="size-4" />
                  )}
                  Charger l’aperçu
                </Button>
              </CardHeader>
              {preview && (
                <CardContent className="space-y-2">
                  <Badge variant="secondary">{preview.n_rows} lignes (base active)</Badge>
                  <TablePreview data={preview} />
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* --- Anomalies / Diagnostic qualité --- */}
          <TabsContent value="anomalies" className="mt-0 space-y-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">Anomalies et qualité</CardTitle>
                  <CardDescription>
                    Complétude par variable, doublons stricts et registre d’anomalies.
                  </CardDescription>
                </div>
                <Button onClick={lancerQuality} disabled={busyQuality} className="shrink-0">
                  {busyQuality ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  Lancer le diagnostic
                </Button>
              </CardHeader>
              {quality && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      {
                        valeur: `${(quality.taux_completude * 100).toFixed(1)} %`,
                        label: 'Complétude',
                      },
                      { valeur: `${(quality.taux_unicite * 100).toFixed(1)} %`, label: 'Unicité' },
                      { valeur: quality.n_duplicates, label: 'Doublons' },
                      { valeur: quality.n_rows, label: 'Lignes' },
                    ].map((t) => (
                      <div key={t.label} className="bg-muted/40 rounded-lg border p-3">
                        <p className="text-2xl font-semibold tabular-nums">{t.valeur}</p>
                        <p className="text-muted-foreground text-xs">{t.label}</p>
                      </div>
                    ))}
                  </div>
                  {quality.anomalies.length > 0 && (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Cible</TableHead>
                            <TableHead>Détail</TableHead>
                            <TableHead>Priorité</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quality.anomalies.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell>{a.type}</TableCell>
                              <TableCell className="max-w-xs truncate" title={a.cible}>
                                {a.cible}
                              </TableCell>
                              <TableCell>{a.detail}</TableCell>
                              <TableCell>
                                <Badge variant={a.priorite === 'Haute' ? 'default' : 'secondary'}>
                                  {a.priorite}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* --- Filtres --- */}
          <TabsContent value="filtres" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filtres (sous-population)</CardTitle>
                <CardDescription>
                  Ajoutez des conditions combinées par ET. Toutes les analyses (tris à plat,
                  croisements, tests, listes…) porteront alors sur cette sous-population.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <SelectChamp
                    label="Variable"
                    value={fCol}
                    onChange={setFCol}
                    options={variables}
                  />
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Opérateur</p>
                    <Select value={fOp} onValueChange={(v) => setFOp(v ?? '=')}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATEURS_FILTRE.map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Valeur</p>
                    {['>', '≥', '<', '≤'].includes(fOp) ? (
                      // Comparaison numérique : saisie libre du seuil.
                      <Input
                        value={fVal}
                        onChange={(e) => setFVal(e.target.value)}
                        placeholder="ex. 25"
                        inputMode="decimal"
                        className="w-48"
                      />
                    ) : fOp === 'contient' ? (
                      // « contient » : recherche de sous-chaîne, saisie libre.
                      <Input
                        value={fVal}
                        onChange={(e) => setFVal(e.target.value)}
                        placeholder="texte à rechercher…"
                        className="w-48"
                      />
                    ) : (
                      // « = » / « ≠ » : on choisit une modalité EXISTANTE.
                      <Select
                        value={fVal || undefined}
                        onValueChange={(v) => setFVal(v ?? '')}
                        disabled={!fCol || busyModalites || modalites.length === 0}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue
                            placeholder={
                              !fCol
                                ? 'Choisir une variable'
                                : busyModalites
                                  ? 'Chargement des modalités…'
                                  : modalites.length === 0
                                    ? 'Aucune modalité'
                                    : 'Choisir une modalité'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {modalites.map((m) => (
                            <SelectItem key={m.valeur} value={m.valeur}>
                              {m.valeur} ({m.effectif})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button onClick={ajouterFiltre} disabled={!fCol || !fVal}>
                    Ajouter la condition
                  </Button>
                </div>

                {filtres.length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">
                    Aucun filtre actif : les analyses portent sur toute la base.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {filtres.map((f, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 py-1">
                          {libelleVariable(f.col)} {f.op} {f.val || '∅'}
                          <button
                            type="button"
                            aria-label="Retirer"
                            onClick={() => setFiltres((prev) => prev.filter((_, j) => j !== i))}
                            className="hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => setFiltres([])}
                    >
                      <Trash2 className="size-4" /> Tout effacer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Liste --- */}
          <TabsContent value="liste" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Liste</CardTitle>
                <CardDescription>
                  Juxtaposez plusieurs variables (ex. pays, nom, prénom, sexe…) sur la base active
                  et filtrée{baseEpuree ? ' (base épurée)' : ''}. Exportable en Word et Excel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <VariablePicker
                  variables={variables}
                  selected={listeCols}
                  onChange={setListeCols}
                />
                <Separator />
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={listeExclureVides} onCheckedChange={setListeExclureVides} />
                    Masquer les lignes vides
                  </label>
                  <Button onClick={lancerListe} disabled={busyListe || listeCols.length === 0}>
                    {busyListe && <Loader2 className="size-4 animate-spin" />}
                    Produire la liste ({listeCols.length})
                  </Button>
                </div>
              </CardContent>
            </Card>
            {liste && (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <CardTitle className="text-base">Liste ({liste.n_rows} lignes)</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exporter(() => exporterListeWord(liste, 'Liste'))}
                    >
                      <FileText className="size-4" /> Word
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exporter(() => exporterListeExcel(liste))}
                    >
                      <Download className="size-4" /> Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <TablePreview data={liste} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --- Guide --- */}
          <TabsContent value="guide" className="mt-0 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <MarkdownRenderer>{GUIDE_MD}</MarkdownRenderer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Méthodologie --- */}
          <TabsContent value="method" className="mt-0 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <MarkdownRenderer>{METHODE_MD}</MarkdownRenderer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Historique */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Historique des traitements</CardTitle>
            <CardDescription>
              Vos analyses enregistrées (base épurée, tris, croisements).
            </CardDescription>
          </div>
          {estSuperAdmin && historique.jobs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1 text-red-600 hover:text-red-700"
              onClick={viderHistorique}
              disabled={busyDetail}
            >
              <Trash2 className="size-4" /> Vider l’archive
            </Button>
          )}
        </CardHeader>
        <CardContent id="archive-dossiers">
          {historique.erreur ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Historique indisponible</p>
              <p className="mt-1">
                La table <code className="font-mono">datastudio_jobs</code> n’est pas encore
                appliquée en base. Lancez la migration{' '}
                <code className="font-mono">20260918000001_datastudio_historique.sql</code>, puis
                rechargez.
              </p>
            </div>
          ) : dossiers.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">
              Aucun traitement enregistré pour l’instant.
            </p>
          ) : (
            <div className="space-y-2">
              {dossiers.map((d) => {
                const ouvert = dossiersOuverts.has(d.cle);
                return (
                  <div key={d.cle} className="overflow-hidden rounded-md border">
                    <button
                      type="button"
                      onClick={() => basculerDossier(d.cle)}
                      className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left"
                    >
                      {ouvert ? (
                        <FolderOpen className="size-4 shrink-0 text-sky-700" />
                      ) : (
                        <Folder className="size-4 shrink-0 text-sky-700" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {d.jobs.length} traitement(s) · dernier le{' '}
                          {new Date(d.derniere).toLocaleDateString('fr-FR')}
                        </span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {d.kind}
                      </Badge>
                      <ChevronDown
                        className={`size-4 shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {ouvert && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Titre</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {d.jobs.map((j) => (
                              <TableRow
                                key={j.id}
                                className="hover:bg-muted/50 cursor-pointer"
                                onClick={() => restaurerTraitement(j.id)}
                              >
                                <TableCell className="font-medium">{j.titre}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{j.type}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {new Date(j.created_at).toLocaleString('fr-FR')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Les traitements sont regroupés en <strong>dossiers par projet / jeu de données</strong>.
            Cliquez un dossier pour le déplier, puis un traitement pour le rouvrir dans l’espace de
            travail (source rechargée, résultat réinjecté, prêt à être édité ou ré-exécuté).
          </p>
        </CardContent>
      </Card>

      {busyDetail && (
        <div className="text-muted-foreground fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow">
          <Loader2 className="size-4 animate-spin" /> Chargement du traitement…
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.titre}</DialogTitle>
                <DialogDescription>
                  {detail.type} · {detail.source_ref ?? detail.source} ·{' '}
                  {new Date(detail.created_at).toLocaleString('fr-FR')}
                </DialogDescription>
              </DialogHeader>
              <HistoriqueDetail detail={detail} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Rendu d'un traitement enregistré (consultation depuis l'historique). */
function HistoriqueDetail({ detail }: { detail: TraitementDetail }) {
  const id = (c: string) => c; // pas de libellés hors contexte : on garde le code
  const payload = detail.payload;

  if (detail.type === 'report') {
    const md = (payload?.rapport as string) ?? '(Rapport indisponible.)';
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigator.clipboard?.writeText(md)}
          >
            Copier
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => exporterRapportPdf(md, detail.titre).catch(() => undefined)}
          >
            <Download className="size-4" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => exporterRapportWord(md, detail.titre).catch(() => undefined)}
          >
            <Download className="size-4" /> Word
          </Button>
        </div>
        <div className="rounded-md border p-4">
          <RapportView markdown={md} />
        </div>
      </div>
    );
  }

  if (detail.type === 'frequency' && payload) {
    const freq = payload as unknown as FrequencyResponse;
    return (
      <div className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => exporterFreqExcel(freq, id).catch(() => undefined)}
        >
          <Download className="size-4" /> Excel
        </Button>
        {Object.entries(freq.tables).map(([name, rows]) => (
          <Card key={name}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalité</TableHead>
                    <TableHead className="text-right">Effectif</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.Modalité === 'Total' ? 'font-semibold' : ''}>
                      <TableCell>{r.Modalité}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.Effectif}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r['%'])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (detail.type === 'crosstab' && payload) {
    const cross = payload as unknown as CrosstabResponse;
    return (
      <div className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => exporterCrossExcel(cross, id).catch(() => undefined)}
        >
          <Download className="size-4" /> Excel
        </Button>
        {cross.layers.map((lyr, li) => (
          <div key={li} className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalité</TableHead>
                  {lyr.columns.map((c) => (
                    <TableHead key={c} className="text-right">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lyr.index.map((idx, ri) => (
                  <TableRow key={idx} className={idx === 'Total' ? 'font-semibold' : ''}>
                    <TableCell>{idx}</TableCell>
                    {lyr.columns.map((c, ci) => (
                      <TableCell key={c} className="text-right tabular-nums">
                        {lyr.counts[ri]?.[ci] ?? 0}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  }

  if (detail.type === 'multi' && payload) {
    const multi = payload as unknown as MultiResponse;
    return (
      <div className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => exporterMultiExcel(multi).catch(() => undefined)}
        >
          <Download className="size-4" /> Excel
        </Button>
        {Object.entries(multi.tables).map(([prefix, table]) => (
          <Card key={prefix}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{prefix}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option</TableHead>
                    <TableHead className="text-right">Effectif</TableHead>
                    <TableHead className="text-right">% répondants</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.Option}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.Effectif}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(r['Pourcentage répondants'])}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Ce traitement ne conserve pas de résultat détaillé consultable (paramètres enregistrés
      seulement).
    </p>
  );
}

/**
 * Sélecteur de variables riche : recherche plein texte, filtres par type de
 * mesure, sélection en masse (tout / aucun / inverser) sur la liste filtrée,
 * compteur, libellés complets + code + badge de mesure. Remplace la grille de
 * cases à cocher ingérable sur les bases à nombreuses variables.
 */
function VariablePicker({
  variables,
  selected,
  onChange,
}: {
  variables: { name: string; display: string; measure: string; cardinality: number }[];
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [mesure, setMesure] = useState<string>('TOUTES');

  const requete = q.trim().toLowerCase();
  const filtrees = variables.filter((v) => {
    if (mesure !== 'TOUTES' && v.measure !== mesure) return false;
    if (!requete) return true;
    return `${v.display} ${v.name}`.toLowerCase().includes(requete);
  });

  const selSet = new Set(selected);
  const nbFiltreesSel = filtrees.filter((v) => selSet.has(v.name)).length;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next]);
  }
  function toutFiltrees() {
    onChange([...new Set([...selected, ...filtrees.map((v) => v.name)])]);
  }
  function aucuneFiltrees() {
    const noms = new Set(filtrees.map((v) => v.name));
    onChange(selected.filter((n) => !noms.has(n)));
  }
  function inverserFiltrees() {
    const next = new Set(selected);
    for (const v of filtrees) {
      if (next.has(v.name)) next.delete(v.name);
      else next.add(v.name);
    }
    onChange([...next]);
  }

  const compteMesure = (m: string) =>
    m === 'TOUTES' ? variables.length : variables.filter((v) => v.measure === m).length;
  const filtresMesure: { cle: string; label: string }[] = [
    { cle: 'TOUTES', label: 'Toutes' },
    { cle: 'NOMINAL', label: 'Nominales' },
    { cle: 'ORDINAL', label: 'Ordinales' },
    { cle: 'ÉCHELLE', label: 'Échelle' },
  ];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une variable (libellé ou code)…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filtresMesure.map((f) => (
          <Button
            key={f.cle}
            type="button"
            size="sm"
            variant={mesure === f.cle ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setMesure(f.cle)}
          >
            {f.label} ({compteMesure(f.cle)})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={toutFiltrees}
        >
          <CheckCheck className="size-3.5" /> Tout sélectionner
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={aucuneFiltrees}
        >
          <SquareDashed className="size-3.5" /> Aucun
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs"
          onClick={inverserFiltrees}
        >
          Inverser
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          {selected.length} sélectionnée(s) · {nbFiltreesSel}/{filtrees.length} affichée(s)
        </span>
      </div>

      <div className="max-h-72 divide-y overflow-auto rounded-md border">
        {filtrees.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm italic">
            Aucune variable ne correspond à la recherche.
          </p>
        ) : (
          filtrees.map((v) => {
            const m = MESURES[v.measure];
            return (
              <label
                key={v.name}
                className="hover:bg-muted/50 flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selSet.has(v.name)}
                  onCheckedChange={() => toggle(v.name)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug" title={v.display}>
                    {v.display}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{v.name}</span>
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${m?.classe ?? 'bg-muted text-muted-foreground'}`}
                  title={v.measure}
                >
                  {m?.court ?? v.measure}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Rendu tabulaire d'un aperçu (Base brute / Liste) : en-têtes = libellés. */
function TablePreview({ data }: { data: PreviewResponse }) {
  return (
    <div className="max-h-[28rem] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {data.columns.map((c, i) => (
              <TableHead key={i} className="whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((r, ri) => (
            <TableRow key={ri}>
              {data.codes.map((code, ci) => (
                <TableCell key={ci} className="whitespace-nowrap">
                  {String(r[code] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Graphique inséré par l'IA dans un rapport via un bloc ```chart {json}. */
function ChartRapport({ spec }: { spec: string }) {
  let type: 'bar' | 'pie' | 'line' = 'bar';
  let titre = '';
  let data: { label: string; value: number }[] = [];
  try {
    const j = JSON.parse(spec.trim());
    type = j.type === 'pie' ? 'pie' : j.type === 'line' ? 'line' : 'bar';
    titre = String(j.titre ?? j.title ?? '');
    const arr = Array.isArray(j.data) ? j.data : [];
    data = arr
      .map((d: { label?: unknown; name?: unknown; value?: unknown; effectif?: unknown }) => ({
        label: String(d.label ?? d.name ?? ''),
        value: Number(d.value ?? d.effectif ?? 0),
      }))
      .filter((d: { label: string; value: number }) => d.label && Number.isFinite(d.value));
  } catch {
    return null;
  }
  if (data.length === 0) return null;
  return (
    <div className="my-3 rounded-lg border p-3">
      {titre && <p className="mb-2 text-sm font-medium">{titre}</p>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Tooltip {...tooltipPropsPremium} />
              <Legend />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={couleurRang(i)} />
                ))}
              </Pie>
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip {...tooltipPropsPremium} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={couleurRang(0)}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip {...tooltipPropsPremium} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={couleurRang(i)} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Rendu d'un rapport : Markdown (titres, tableaux) + graphiques ```chart. */
function RapportView({ markdown }: { markdown: string }) {
  const re = /```chart\s*([\s\S]*?)```/g;
  const parts: { type: 'text' | 'chart'; content: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: markdown.slice(last, m.index) });
    parts.push({ type: 'chart', content: m[1] ?? '' });
    last = re.lastIndex;
  }
  if (last < markdown.length) parts.push({ type: 'text', content: markdown.slice(last) });
  return (
    <div className="space-y-2">
      {parts.map((p, i) =>
        p.type === 'chart' ? (
          <ChartRapport key={i} spec={p.content} />
        ) : p.content.trim() ? (
          <MarkdownRenderer key={i}>{p.content}</MarkdownRenderer>
        ) : null,
      )}
    </div>
  );
}

function SelectChamp({
  label,
  value,
  onChange,
  options,
  aucune = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { name: string; display: string }[];
  aucune?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Choisir…" />
        </SelectTrigger>
        <SelectContent>
          {aucune && <SelectItem value={AUCUNE}>[Aucune]</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.name} value={o.name}>
              {o.display}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
