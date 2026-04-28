# Capacitor — Application mobile iOS / Android

**V2.3.0** — Packaging de la plateforme OIF Emploi Jeunes en application
mobile native via [Capacitor](https://capacitorjs.com/).

## Architecture choisie : **Mode remote-server**

Capacitor charge l'application web déployée (`https://suivi-projet.org`)
dans un WebView natif iOS / Android. L'utilisateur obtient une **vraie app
installable** depuis App Store / Play Store, avec **100 % des
fonctionnalités existantes** (Server Actions, RLS, view-as, magic links,
imports Excel…).

### Pourquoi ce choix (et pas l'export statique)

La plateforme utilise massivement :

- **~50 Server Actions Next.js** (création utilisateurs, lancement
  campagnes, application de corrections IA, etc.)
- **API routes** (`/api/imports/*`, `/api/auth/callback`, exports Excel)
- **Middleware** (rate-limit, garde routes auth, view-as)
- **Cookies httpOnly Supabase** pour l'authentification SSR
- **Génération dynamique** des pages dashboard avec données live

Toutes ces fonctionnalités sont **incompatibles avec
`output: 'export'`** (Next.js static export). Migrer vers le mode
statique nécessiterait :

- Réécrire les 50 Server Actions en API routes client-side
- Perdre la sécurité des cookies httpOnly
- Casser le flux magic link (qui dépend de `/api/auth/callback`)
- Faire fuiter la clé Supabase anon dans le bundle client

Le **mode remote-server** évite tout ça : l'app mobile est un *WebView
managé* qui pointe vers le serveur de production.

---

## Installation

Les packages Capacitor sont déjà installés :

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/splash-screen @capacitor/status-bar \
            @capacitor/preferences @capacitor/network
```

Configuration : voir `capacitor.config.ts` à la racine.

---

## Build iOS

### Pré-requis

- macOS
- Xcode 15+ (App Store)
- CocoaPods (`brew install cocoapods`)
- Compte Apple Developer (99 $/an pour publier)

### Procédure

```bash
# 1. Ajouter la plateforme iOS (une seule fois)
npx cap add ios

# 2. Synchroniser webDir + plugins
npx cap sync ios

# 3. Ouvrir Xcode
npx cap open ios
```

Dans Xcode :
- Configurer le **Team** (Apple Developer)
- Signer avec le certificat
- Sélectionner un device ou simulateur
- ▶︎ Run

Pour publier sur l'**App Store** :
1. Product → Archive
2. Distribute App → App Store Connect
3. Soumettre pour revue (5-7 jours)

### Icônes & splash screen

Placer les assets dans `resources/icon.png` (1024×1024) et
`resources/splash.png` (2732×2732), puis :

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --ios
```

---

## Build Android

### Pré-requis

- Android Studio (IntelliJ-based, multi-OS)
- Java JDK 17+
- Android SDK 33+
- Compte Google Play Developer (25 $ une fois pour publier)

### Procédure

```bash
# 1. Ajouter la plateforme Android (une seule fois)
npx cap add android

# 2. Synchroniser
npx cap sync android

# 3. Ouvrir Android Studio
npx cap open android
```

Dans Android Studio :
- Build → Generate Signed Bundle / APK
- Créer une **keystore** (à conserver précieusement — la clé est requise
  pour toutes les futures mises à jour)
- Build le `.aab` (Android App Bundle, format Play Store)

Pour publier sur **Google Play** :
1. Créer une console développeur
2. Uploader l'.aab
3. Compléter la fiche store + classifications de contenu
4. Publier (revue 24-48h)

---

## Développement local

### Pointer vers un serveur Next.js local

Surcharger `server.url` dans `capacitor.config.ts` (ne PAS commiter
cette modification) :

```typescript
server: {
  url: 'http://192.168.1.X:3000',  // IP de votre Mac sur le LAN
  cleartext: true,                  // autorise HTTP en dev
  allowNavigation: ['*'],
},
```

Lancer Next.js avec accès LAN :

```bash
npm run dev -- --hostname 0.0.0.0
```

Re-synchroniser et lancer l'app :

```bash
npx cap sync
npx cap run ios       # ou android
```

### Live reload (optionnel)

Capacitor supporte le live-reload via :

```bash
npx cap run ios -l --external
```

L'app pointe alors sur le bundler Next dev sur votre LAN.

---

## Plugins activés (V2.3.0)

| Plugin | Rôle |
|---|---|
| `@capacitor/splash-screen` | Écran de démarrage bleu OIF avec spinner doré, 1,5 s |
| `@capacitor/status-bar` | Bar de statut bleu OIF (assortie au header) |
| `@capacitor/preferences` | Stockage local sécurisé (préférences utilisateur) |
| `@capacitor/network` | Détection online / offline (banner « Mode hors-ligne ») |
| `@capacitor/keyboard` | Resize automatique pour ne pas masquer les inputs |

---

## V2.4 — Améliorations envisagées

- **Notifications push** via `@capacitor/push-notifications` (rappels de
  campagnes, alertes admin SCS)
- **Biométrie** (`@capacitor/biometric`) : Face ID / Touch ID pour
  accélérer les reconnexions
- **Mode hors-ligne partiel** avec `@capacitor/preferences` + cache
  service-worker (consultation des dashboards en avion)
- **Deep links** pour ouvrir des fiches bénéficiaire spécifiques depuis
  un email / SMS

---

## FAQ

### Pourquoi pas une PWA ?

Les PWA ne sont **pas distribuables sur App Store** (Apple les refuse) et
Google Play les rejette de plus en plus depuis 2024. Capacitor produit de
**vraies apps natives** acceptées par les deux stores.

### Que se passe-t-il si suivi-projet.org est down ?

Le WebView affiche une page d'erreur native iOS/Android. En V2.4 nous
ajouterons un fallback offline avec `@capacitor/network` qui affichera
un message « Mode hors-ligne » + bouton « Réessayer ».

### Puis-je tester sans Mac ?

Pour iOS : non (Xcode requiert macOS). Solution : utiliser un service
cloud type [Codemagic](https://codemagic.io/) ou
[Bitrise](https://www.bitrise.io/).
Pour Android : oui, Android Studio est multi-OS.

### Comment mettre à jour l'app après une release web ?

**Pas besoin** ! Le WebView charge à chaque ouverture la dernière version
de `suivi-projet.org`. Les utilisateurs voient instantanément les
nouvelles features sans passer par l'App Store.

Les seules raisons de re-soumettre l'app aux stores :
- Modifier le splash screen / l'icône
- Activer un nouveau plugin natif (push notifications, etc.)
- Mettre à jour Capacitor lui-même

---

## Contact

Documentation Capacitor officielle :
[https://capacitorjs.com/docs](https://capacitorjs.com/docs)

Questions internes : SCS Paris, Carlos HOUNSINOU.
