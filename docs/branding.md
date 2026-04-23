# Charte graphique — Plateforme OIF Emploi Jeunes

> Document vivant. Source normative : [`docs/branding/sources/OIF_mini_charte.pdf`](branding/sources/OIF_mini_charte.pdf) (éd. 2007, W & Cie).

## Principes fondamentaux

1. **Respect strict** de la charte graphique OIF officielle : logos, couleurs, typographie, espace protégé, tailles minimum.
2. **Logos verrouillés** — pas de création de variantes non listées. Pas de recoloration.
3. **Couleurs institutionnelles verrouillées** — définies en code dans `lib/design/oif/colors.ts` et en CSS dans `app/globals.css` sous `@theme inline`. Valeurs non éditables sans validation du Service de communication OIF (`com@francophonie.org`).
4. **Typographie** : Inter en web (substitut libre de Helvetica Neue) avec fallback Helvetica Neue sur les systèmes Apple. Aucune police Maverick (réservée aux documents imprimés officiels).

## Logos disponibles

Dans `public/assets/branding/oif/` — 4 variantes officielles, aucune autre :

| Fichier | Variante composant | Usage recommandé |
|---------|---------------------|------------------|
| `logo-oif-quadri.png` | `<LogoOIF variant="quadri" />` **(défaut)** | Fond blanc ou très clair — **version à privilégier** (charte p. 7) |
| `logo-oif-quadri-texte-blanc.png` | `<LogoOIF variant="quadri-texte-blanc" />` | Fond gris foncé / bleu foncé / métal foncé |
| `logo-oif-noir.png` | `<LogoOIF variant="noir" />` | Monochrome aplat noir — tampon, fax, sérigraphie |
| `logo-oif-blanc.png` | `<LogoOIF variant="blanc" />` | Monochrome aplat blanc — fond aplat de couleur |

### Sources archivées

Les fichiers EPS originaux (PostScript) sont conservés dans `docs/branding/sources/`. Ils doivent être utilisés pour toute nouvelle reproduction (impression, marquage). Les PNG servent exclusivement pour le web (V1 — une conversion SVG par un designer est à prévoir pour la V2 afin d'améliorer la qualité de rendu à toutes tailles).

## Palette de couleurs

### Six couleurs du logotype (source : charte p. 8)

| Nom | Hex | Pantone | RGB | Classe Tailwind |
|-----|-----|---------|-----|----------------|
| gris | `#2E292D` | Cool Gray 11 C | 46, 41, 45 | — |
| jaune | `#FDCD00` | 116 C | 253, 205, 0 | — |
| vert | `#7EB301` | 376 C | 126, 179, 1 | — |
| violet | `#5D0073` | 2603 C | 93, 0, 115 | — |
| rouge | `#E40001` | 485 C | 228, 0, 1 | — |
| bleu cyan | `#0198E9` | Process Cyan C | 1, 152, 233 | — |

Accessibles par :
- Variables CSS : `var(--color-oif-gris)`, `var(--color-oif-jaune)`, …, `var(--color-oif-bleu-cyan)`
- Import TypeScript : `import { OIF_COLORS_LOGO } from '@/lib/design/oif/colors';`

### Couleurs complémentaires (Instances de la Francophonie)

| Nom | Hex | Pantone | Usage |
|-----|-----|---------|-------|
| violet Instances | `#7D0996` | 2602 C | Sommets des chefs d'État et de gouvernement |
| bleu Instances | `#3878DB` | 2727 C | CMF (Conférence ministérielle) |
| jaune Instances | `#FDCD00` | 116 C | CPF (Conseil permanent) |
| gris clair | `#DFDCD8` | Warm gray 1 C | Autres éditions |

### Couleurs des Programmes Stratégiques

| Code | Libellé | Hex principal | Pantone |
|------|---------|--------------|---------|
| PS1 | La langue française au service des cultures et de l'éducation | `#0198E9` | Process Cyan C |
| PS2 | La langue française au service de la démocratie et de la gouvernance | `#5D0073` | 2603 C |
| PS3 | La langue française, vecteur de développement durable | `#7EB301` | 376 C |

Source : [`docs/branding/sources/Code couleur programmation OIF.pdf`](branding/sources/Code%20couleur%20programmation%20OIF.pdf).

Accessibles par : `import { PROGRAMMES_STRATEGIQUES, couleurPSPrincipale } from '@/lib/design/oif/programmes';`

## Typographie

### Web — configuration plateforme

- **Police principale** : **Inter** (Google Fonts, OFL) — chargée via `next/font/google` dans `app/layout.tsx`.
- **Fallback** : `Helvetica Neue`, `Helvetica`, `Arial`, `sans-serif`.
- **Variable CSS** : `--font-inter` (définie par `next/font`), exposée en `--font-sans` dans le `@theme`.
- **Graisses embarquées** : 300, 400, 500, 600, 700, 900 (alignées sur Light / Roman / Medium / Bold / Black de Helvetica Neue — cf. charte p. 9).

### Rationale Inter plutôt que Helvetica Neue

- Helvetica Neue est une police commerciale non libre. L'embarquer sur une plateforme institutionnelle publique exige une licence serveur par domaine — ~200 €/an.
- Inter est la substituion sans-sérif grotesque la plus proche visuellement, libre (OFL), optimisée pour les écrans, utilisée par Notion, GitHub, Vercel, Figma.
- Sur macOS et iOS (Safari, apps natives), le fallback CSS pointe automatiquement vers Helvetica Neue installée système → les utilisateurs Apple voient la police officielle OIF.

### Imprimé — Maverick et Helvetica Neue

Les documents PDF générés par la plateforme (exports, rapports) conservent Helvetica Neue si installée système, sinon Inter. Maverick n'est pas utilisée en V1.

## Règles d'usage du logotype

### Taille minimum (charte p. 6)

**25 mm de largeur** en impression, équivalent **96 px** en web. Le composant `<LogoOIF>` refuse toute valeur inférieure avec un warning console en développement.

### Espace protégé (charte p. 6)

Hauteur du « L » de « la francophonie » tout autour du logo — implémenté comme `padding = largeur × 10 %` dans le composant (approximation fidèle).

Prop `withProtectedSpace` (défaut `true`) pour ajouter automatiquement cet espace. Désactivable uniquement dans un conteneur qui le respecte déjà.

### Fonds autorisés (charte p. 7)

| Fond | Version à utiliser |
|------|--------------------|
| Blanc | **quadri** (couleur) — PRIVILÉGIÉE |
| Gris clair, métal chromé, alu | quadri |
| Gris foncé, bleu foncé, métal foncé | quadri-texte-blanc |
| Fond visuel, photo, fond perturbé | **quadri avec cartouche blanc** (container `bg-white` conseillé) |
| Fond aplat de couleur | blanc (monochrome blanc) |

### Cosignature (charte p. 10)

Non implémentée en V1 — à prévoir si le SCS doit co-signer des documents avec des partenaires (Union européenne, ONU, AUF, etc.). À ajouter au backlog quand le cas surviendra.

## INTERDITS FORMELS (charte p. 11)

Les 12 usages prohibés par la charte sont **bannis**. Le composant `<LogoOIF>` ne permet techniquement d'en violer aucun (pas d'override de couleurs ni de ratio). Liste pour mémoire :

1. Mise en couleurs non conforme
2. Construction de la typographie non conforme
3. Espace de protection non respecté
4. Déformation du logotype
5. Taille inférieure à la taille minimum (25 mm / 96 px)
6. Version monochrome créée (hors des 6 versions listées charte p. 5)
7. Version monochrome aplat noir non conforme
8. Association d'un symbole à l'intérieur du logotype
9. Utilisation d'une version monochrome sur un fond de couleur
10. Version monochrome aplat blanc où les interstices de l'emblème disparaissent
11. Logotype couleur sur un fond proche d'une couleur de l'emblème
12. Logotype couleur sur un fond perturbé (photo, visuel) sans cartouche blanc

## Contact officiel OIF pour questions branding

> Service de communication de l'OIF
> 13, quai André-Citroën, 75015 Paris (France)
> Tél. +33 (0)1 44 37 33 93
> Mail : **com@francophonie.org**
> Web : www.francophonie.org

## Historique

| Version | Date | Changement |
|---------|------|-----------|
| 1.0 | 2026-04-23 | Intégration initiale : design system, LogoOIF composant, Inter font, intégration sidebar / mobile / connexion / en-attente, documentation complète |
