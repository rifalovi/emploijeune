import type { Metadata } from 'next';
import {
  BookOpen,
  Home,
  ClipboardList,
  BarChart3,
  Upload,
  Sparkles,
  Settings,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';

export const metadata: Metadata = {
  title: 'Guide d’utilisation — OIF Emploi Jeunes',
};

export const dynamic = 'force-dynamic';

/**
 * Guide d'utilisation interne — accessible à tous les rôles authentifiés.
 * Cadre les bonnes pratiques de saisie, d'import, et d'usage des indicateurs.
 *
 * Pas de contenu dynamique : page statique qui sert de référence pour la
 * prise en main de la plateforme (incl. la phase pilote du 15 juin 2026).
 */
export default async function GuidePage() {
  const utilisateur = await requireUtilisateurValide();
  const role = utilisateur.role;

  return (
    <div className="space-y-8 pb-8">
      {/* En-tête */}
      <header className="rounded-2xl bg-gradient-to-br from-[#0E4F88] to-[#0E4F88]/80 p-6 text-white">
        <div className="flex items-center gap-3">
          <BookOpen className="size-7" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Guide d’utilisation</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/90">
          Cadre de référence pour la prise en main de la plateforme OIF Emploi Jeunes : modules
          accessibles selon votre rôle, conventions de saisie, et flux types (import → indicateurs →
          analyses → publication). Document vivant — mis à jour à chaque release majeure.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
          Rôle connecté : <strong className="ml-1">{libelleRole(role)}</strong>
        </p>
      </header>

      {/* Sommaire */}
      <nav className="rounded-xl border bg-white p-4 text-sm" aria-label="Sommaire">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Sommaire
        </p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <li>
            <a href="#demarrage" className="text-[#0E4F88] hover:underline">
              1. Démarrage rapide
            </a>
          </li>
          <li>
            <a href="#modules" className="text-[#0E4F88] hover:underline">
              2. Modules par rôle
            </a>
          </li>
          <li>
            <a href="#imports" className="text-[#0E4F88] hover:underline">
              3. Importer des données
            </a>
          </li>
          <li>
            <a href="#indicateurs" className="text-[#0E4F88] hover:underline">
              4. Indicateurs CMR
            </a>
          </li>
          <li>
            <a href="#saisie" className="text-[#0E4F88] hover:underline">
              5. Saisie manuelle et publication
            </a>
          </li>
          <li>
            <a href="#analyses" className="text-[#0E4F88] hover:underline">
              6. Analyses IA et vitrine publique
            </a>
          </li>
          <li>
            <a href="#bonnes-pratiques" className="text-[#0E4F88] hover:underline">
              7. Bonnes pratiques
            </a>
          </li>
          <li>
            <a href="#support" className="text-[#0E4F88] hover:underline">
              8. Support
            </a>
          </li>
        </ul>
      </nav>

      {/* 1. Démarrage */}
      <Section id="demarrage" titre="1. Démarrage rapide" icone={<Home className="size-5" />}>
        <p>
          La plateforme couvre 4 piliers du Cadre Commun de Mesure du Rendement V2 (compétences,
          création d’emplois, intermédiation, écosystèmes) plus un marqueur transversal sur la
          langue française. Les 18 indicateurs CMR sont alimentés en priorité par les données
          collectées (bénéficiaires, structures, enquêtes) et complétés ponctuellement par saisie
          manuelle quand un dénominateur manque.
        </p>
        <Conseil type="info">
          Commencez par l’<strong>Accueil</strong> qui synthétise les volumétries des piliers, puis
          explorez <strong>Indicateurs</strong> pour visualiser les valeurs annuelles.
        </Conseil>
      </Section>

      {/* 2. Modules par rôle */}
      <Section id="modules" titre="2. Modules par rôle" icone={<Settings className="size-5" />}>
        <Tableau
          colonnes={['Module', 'Description', 'Rôles autorisés']}
          lignes={[
            ['Bénéficiaires', 'Liste, recherche, rapprochement (déduplication)', 'Tous les rôles'],
            [
              'Structures',
              'Micro-entreprises et AGR appuyées, montants, statut création/renforcement',
              'Tous les rôles',
            ],
            [
              'Enquêtes',
              'Lancement, suivi des réponses, exports (insertion 6/12 mois, satisfaction…)',
              'Tous (édition : admin_scs + super_admin)',
            ],
            [
              'Indicateurs',
              '18 indicateurs CMR avec valeurs annuelles et graphiques',
              'Tous les rôles',
            ],
            [
              'Imports',
              'Téléversement de fichiers Excel/CSV/Docx (classique ou IA)',
              'Sauf lecteur',
            ],
            [
              'Administration',
              'Utilisateurs, projets, modules, paramètres',
              'admin_scs, super_admin',
            ],
            [
              'Super Admin',
              'Modules activables, monitoring import IA, analyses IA',
              'super_admin uniquement',
            ],
            [
              'Assistant IA',
              'Posez des questions en français sur les données (RAG)',
              'Tous (si activé)',
            ],
          ]}
        />
      </Section>

      {/* 3. Imports */}
      <Section id="imports" titre="3. Importer des données" icone={<Upload className="size-5" />}>
        <p>
          Trois flux d’import sont disponibles : <strong>bénéficiaires</strong>,{' '}
          <strong>structures</strong>, <strong>réponses d’enquête</strong>. Pour chaque flux, deux
          modes possibles :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Import classique</strong> : Excel/CSV avec colonnes attendues (ex. prenom, nom,
            sexe, pays_code…). Mapping strict.
          </li>
          <li>
            <strong>Import IA</strong> : fichier libre (Excel, CSV, Docx, PDF). L’IA détecte les
            colonnes et propose un mapping. À valider avant insertion.
          </li>
        </ul>
        <Conseil type="warning">
          Les imports sont <strong>réversibles 30 jours</strong> : depuis{' '}
          <em>Imports → Sessions</em>, vous pouvez annuler une session (suppression douce des
          lignes) avant publication aux utilisateurs.
        </Conseil>
        <Conseil type="success">
          <strong>Bonnes pratiques :</strong> harmonisez les pays sur leur code ISO (BJ, BF, CI…),
          utilisez le format YYYY-MM-DD pour les dates, et évitez les colonnes vides au milieu du
          tableau Excel.
        </Conseil>
      </Section>

      {/* 4. Indicateurs */}
      <Section id="indicateurs" titre="4. Indicateurs CMR" icone={<BarChart3 className="size-5" />}>
        <p>
          La page <em>Indicateurs</em> regroupe les 18 indicateurs des 4 piliers + 1 marqueur.
          Chaque indicateur expose :
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Statut</strong> : Calculé (BDD) · Saisie manuelle · En attente de collecte · Pas
            de données.
          </li>
          <li>
            <strong>Valeurs par année</strong> : numérateur, dénominateur, ventilation (femmes /
            hommes pour A1, création / renforcement pour B1).
          </li>
          <li>
            <strong>Graphique</strong> : 4 types disponibles (barres, ligne, aire, secteur) avec
            sélecteur en haut de la zone visualisation.
          </li>
          <li>
            <strong>Métadonnées CMR</strong> : méthode de calcul, sources, fréquence, précautions.
          </li>
        </ul>
        <Conseil type="info">
          La visualisation s’active automatiquement à partir de <strong>2 années</strong> de données
          collectées. Le super_admin peut forcer son activation/désactivation depuis la page détail.
        </Conseil>
      </Section>

      {/* 5. Saisie manuelle + publication */}
      <Section
        id="saisie"
        titre="5. Saisie manuelle et publication"
        icone={<ClipboardList className="size-5" />}
      >
        <p>
          Pour les indicateurs qui ne sont pas encore alimentés par la BDD (A3, A5, B2, C1…), les
          rôles <strong>admin_scs</strong> et <strong>super_admin</strong> peuvent saisir
          manuellement les valeurs depuis la page détail d’un indicateur (bloc bleu « Saisie
          manuelle »).
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Taux</strong> : saisissez <em>numérateur + dénominateur</em>. Le pourcentage est
            calculé automatiquement.
          </li>
          <li>
            <strong>Volume</strong> : saisissez <em>valeur directe</em> (effectif, montant, jours).
          </li>
          <li>
            Chaque saisie possède un état <strong>Brouillon</strong> (gris, visible uniquement par
            les admins) ou <strong>Publié</strong> (vert, visible par tous les rôles et la vitrine
            publique). Cliquez sur le badge pour basculer.
          </li>
        </ul>
        <Conseil type="warning">
          Le calcul automatique BDD reste <strong>prioritaire</strong> : si une enquête fournit la
          donnée plus tard, elle remplacera la saisie sans action de votre part.
        </Conseil>
      </Section>

      {/* 6. Analyses IA */}
      <Section
        id="analyses"
        titre="6. Analyses IA et vitrine publique"
        icone={<Sparkles className="size-5" />}
      >
        <p>
          Depuis <em>Super Admin → Analyses indicateurs</em>, le super_admin peut générer un
          commentaire interprétatif via Claude pour chaque indicateur. L’analyse est d’abord en
          brouillon, modifiable, puis publiable. Une seule analyse publiée par indicateur (la
          précédente repasse automatiquement en brouillon).
        </p>
        <p>
          Les analyses publiées apparaissent sur la <strong>vitrine publique</strong> (
          <code>/realisations/[pilier]/[indicateur]</code>), au-dessus des chiffres-clés.
        </p>
      </Section>

      {/* 7. Bonnes pratiques */}
      <Section
        id="bonnes-pratiques"
        titre="7. Bonnes pratiques"
        icone={<Lightbulb className="size-5" />}
      >
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Préférer l’import IA</strong> pour les fichiers non normalisés (ex. fichiers
            partenaires terrain) — gain de temps + détection automatique des colonnes.
          </li>
          <li>
            <strong>Vérifier le rapport d’import</strong> avant de fermer la session : les lignes
            rejetées sont indiquées avec le motif (pays inconnu, doublon, sexe invalide…).
          </li>
          <li>
            <strong>Saisies manuelles temporaires</strong> : garder une note explicative (champ
            optionnel) pour tracer la source (rapport SCS, enquête tierce…).
          </li>
          <li>
            <strong>Ne pas publier en masse</strong> sans revue : la publication rend les valeurs
            visibles publiquement.
          </li>
        </ul>
      </Section>

      {/* 8. Support */}
      <Section
        id="support"
        titre="8. Support et contact"
        icone={<ShieldAlert className="size-5" />}
      >
        <p>
          Pour toute question, bug ou demande d’évolution, contactez le SCS (Système Commun de
          Suivi) de l’OIF. La plateforme est en phase pilote — vos retours sont précieux pour
          stabiliser les flux avant déploiement large.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Version 2.5.2 — Dernière mise à jour le {new Date().toLocaleDateString('fr-FR')}
        </p>
      </Section>
    </div>
  );
}

// ─── Sous-composants utilitaires ────────────────────────────────────────────

function Section({
  id,
  titre,
  icone,
  children,
}: {
  id: string;
  titre: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border bg-white p-5">
      <header className="mb-3 flex items-center gap-2 text-[#0E4F88]">
        <span aria-hidden>{icone}</span>
        <h2 className="text-base font-semibold">{titre}</h2>
      </header>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Conseil({
  type,
  children,
}: {
  type: 'info' | 'warning' | 'success';
  children: React.ReactNode;
}) {
  const map = {
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      icone: <Lightbulb className="size-4" aria-hidden />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icone: <AlertTriangle className="size-4" aria-hidden />,
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icone: <CheckCircle2 className="size-4" aria-hidden />,
    },
  };
  const cfg = map[type];
  return (
    <aside className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cfg.bg}`}>
      <span className="mt-0.5">{cfg.icone}</span>
      <div>{children}</div>
    </aside>
  );
}

function Tableau({ colonnes, lignes }: { colonnes: string[]; lignes: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[480px] text-xs">
        <thead className="bg-slate-50 tracking-wide text-slate-500 uppercase">
          <tr>
            {colonnes.map((c) => (
              <th key={c} className="px-3 py-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {lignes.map((l, idx) => (
            <tr key={idx}>
              {l.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 align-top">
                  {ci === 0 ? <strong className="text-slate-800">{cell}</strong> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function libelleRole(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super administrateur',
    admin_scs: 'Administrateur SCS',
    editeur_projet: 'Éditeur projet',
    contributeur_partenaire: 'Contributeur partenaire',
    lecteur: 'Lecteur',
  };
  return map[role] ?? role;
}
