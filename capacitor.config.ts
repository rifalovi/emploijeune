import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuration Capacitor — OIF Emploi Jeunes V2.3.0.
 *
 * Stratégie : MODE REMOTE-SERVER (et non export statique).
 *
 * Pourquoi : la plateforme utilise massivement les Server Actions Next.js
 * (~50), Supabase Auth avec cookies httpOnly, le middleware (rate-limit +
 * garde routes), et les API routes (/api/imports/*, /api/auth/callback,
 * exports Excel). Toutes ces fonctionnalités sont incompatibles avec
 * `output: 'export'` (Next.js static export). Migrer vers le mode
 * statique nécessiterait de réécrire 50+ Server Actions en API routes
 * client-side, perdrait la sécurité RLS via cookies httpOnly, et
 * casserait le flux magic link.
 *
 * Solution : Capacitor charge l'application web déployée
 * (suivi-projet.org) dans un WebView natif iOS / Android. L'utilisateur
 * obtient une vraie app installable depuis App Store / Play Store, avec
 * 100 % des fonctionnalités existantes (authentification, Server Actions,
 * RLS, view-as, etc.) — exactement comme dans Safari / Chrome.
 *
 * Pour développement local : surcharger `server.url` avec
 * `http://<ip-locale>:3000` dans capacitor.config.ts (non commité).
 */
const config: CapacitorConfig = {
  appId: 'org.francophonie.emploijeunes',
  appName: 'OIF Emploi Jeunes',
  /**
   * Dossier "vide" servant de base à Capacitor. En mode remote, ce
   * dossier contient juste un index.html de fallback (loading screen
   * affiché si le serveur distant est inaccessible).
   */
  webDir: 'capacitor-webview',
  server: {
    /**
     * URL de production. Capacitor charge cette URL dans le WebView au
     * lieu d'utiliser webDir. L'utilisateur voit l'application complète
     * exactement comme sur le web.
     *
     * En dev local, surcharger via .capacitorrc ou variable d'env.
     */
    url: 'https://suivi-projet.org',
    /**
     * `cleartext: false` en production (HTTPS only). Activer à `true`
     * uniquement pour pointer vers un serveur HTTP local en dev.
     */
    cleartext: false,
    /**
     * Hostnames autorisés pour la navigation interne (auth callback,
     * magic links, etc.). Ajouter ici toute redirection externe permise.
     */
    allowNavigation: ['suivi-projet.org', '*.supabase.co', 'francophonie.org'],
  },
  ios: {
    contentInset: 'automatic',
    /** Empêche le scroll vertical de "rebondir" en bas (UX iOS native). */
    scrollEnabled: true,
    /** Autorise les liens externes (mailto:, tel:) à s'ouvrir dans Safari. */
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    /** Autorise le javascript et le DOM storage (cookies Supabase). */
    allowMixedContent: false,
    /** Le WebView Android utilise WebView Chrome (mise à jour Play Store). */
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Splash bleu OIF #0E4F88, durée 1.5s.
      launchShowDuration: 1500,
      backgroundColor: '#0E4F88',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#F5A623',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Bar de statut bleu OIF (assortie au header de l'app).
      backgroundColor: '#0E4F88',
      style: 'DARK',
      overlaysWebView: false,
    },
    Keyboard: {
      // Resize automatique du WebView pour que les inputs ne soient pas
      // masqués par le clavier.
      resize: 'body',
      style: 'DEFAULT',
    },
  },
};

export default config;
