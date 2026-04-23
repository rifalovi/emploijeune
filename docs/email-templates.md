# Templates emails Supabase — Plateforme OIF Emploi Jeunes

## Objet de ce document

Archive des **templates HTML** utilisés dans le Dashboard Supabase Auth pour envoyer les magic links et autres emails transactionnels. Ces templates ne sont pas dans le code mais dans l'interface Supabase (*Dashboard → Authentication → Email Templates*). Cette doc sert de référence pour les retrouver rapidement, contrôler les versions, et documenter les règles éditoriales.

---

## Règles éditoriales

Tous les emails envoyés par la plateforme respectent ces règles :

1. **Français obligatoire** — pas de copie d'anglais, pas de formulation « traduite ».
2. **Vouvoiement systématique** — même quand on s'adresse à des partenaires terrain. Le registre institutionnel OIF l'exige.
3. **Mention OIF complète à la première occurrence** — « Organisation Internationale de la Francophonie (OIF) ». Usage de l'acronyme ensuite.
4. **Ton sobre institutionnel** — pas d'emojis, pas de formules marketing (« 🎉 », « Bienvenue dans la communauté ! »). Concis, factuel, courtois.
5. **Nom de l'expéditeur** : « Plateforme Emploi Jeunes OIF » (configuré dans Supabase SMTP Settings).
6. **Signature de pied** identique pour tous les emails :
   > Service de Conception et Suivi de projet — Organisation Internationale de la Francophonie
   > Pour toute question : projets@francophonie.org
7. **Pas de lien de désinscription** — l'authentification est consentie à la création du compte ; les emails transactionnels ne sont pas du marketing.
8. **Mobile-first** — largeur 600 px maxi, pas de tableaux imbriqués lourds, typographie sans serif.
9. **Pas d'images distantes** — logo en inline base64 ou SVG si vraiment nécessaire. Beaucoup de clients mail bloquent les images externes.

---

## Variables Supabase disponibles

À utiliser via le template engine `{{ .Var }}` dans le dashboard Supabase :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{ .ConfirmationURL }}` | Lien complet prêt à cliquer (inclut token + redirect) | `https://app.example.org/api/auth/callback?token_hash=...&type=magiclink&next=/dashboard` |
| `{{ .Token }}` | Jeton OTP 6 chiffres (alternative au lien) | `123456` |
| `{{ .TokenHash }}` | Hash du token (usage avancé) | `a1b2c3...` |
| `{{ .Email }}` | Adresse du destinataire | `prenom.nom@example.org` |
| `{{ .SiteURL }}` | URL racine configurée dans Supabase | `https://app.example.org` |
| `{{ .RedirectTo }}` | Chemin de redirection après connexion | `/dashboard` |
| `{{ .Data }}` | Métadonnées user (si fournies à `signInWithOtp`) | JSON libre |

---

## Template 1 — Magic Link (connexion)

**Supabase** : *Authentication → Email Templates → Magic Link*

**Sujet** : `Votre lien de connexion à la Plateforme Emploi Jeunes OIF`

**HTML** : *(à coller par Carlos dans le dashboard ; copie ici pour archive)*

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Connexion — Plateforme Emploi Jeunes OIF</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <div style="display:inline-block;background:#0f172a;color:#ffffff;font-weight:700;padding:10px 14px;border-radius:6px;font-size:16px;">OIF</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px 32px;">
              <h1 style="margin:0;font-size:20px;color:#0f172a;font-weight:600;">Votre lien de connexion</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;color:#334155;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 16px 0;">Bonjour,</p>
              <p style="margin:0 0 16px 0;">
                Vous avez demandé un lien de connexion à la <strong>Plateforme Emploi Jeunes</strong> de l'Organisation Internationale de la Francophonie (OIF).
              </p>
              <p style="margin:0 0 24px 0;">Cliquez sur le bouton ci-dessous pour accéder à la plateforme :</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 24px 32px;">
              <a href="{{ .ConfirmationURL }}"
                 style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">
                Me connecter à la plateforme
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px 32px;color:#64748b;font-size:13px;line-height:1.6;">
              <p style="margin:0 0 8px 0;">Ce lien est <strong>valable 1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
              <p style="margin:0 0 8px 0;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce courriel.</p>
              <p style="margin:0;">Si le bouton ne fonctionne pas, copiez-collez le lien suivant dans votre navigateur :<br />
                <span style="word-break:break-all;color:#0f172a;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px 32px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;line-height:1.5;">
              <p style="margin:0;">
                Service de Conception et Suivi de projet — Organisation Internationale de la Francophonie<br />
                Pour toute question : <a href="mailto:projets@francophonie.org" style="color:#0f172a;">projets@francophonie.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 2 — Confirm signup (première inscription)

**Supabase** : *Authentication → Email Templates → Confirm signup*

**Note** : dans la configuration actuelle (`enable_confirmations = false`), ce template n'est **pas utilisé** car la confirmation explicite n'est pas demandée — Supabase envoie directement un magic link. Il est fourni ici comme template de secours au cas où la politique changerait (activation de double opt-in en V2 par exemple).

**Sujet** : `Confirmer votre inscription à la Plateforme Emploi Jeunes OIF`

**HTML** : identique au template 1 avec les ajustements suivants :
- Titre : « Confirmer votre inscription »
- Paragraphe d'intro : « Vous venez de vous inscrire à la Plateforme Emploi Jeunes de l'Organisation Internationale de la Francophonie (OIF). Cliquez sur le bouton ci-dessous pour confirmer votre adresse et activer votre compte. »
- Bouton : « Confirmer mon adresse »
- Mention : « Ce lien expire dans 24 heures. »

---

## Procédure de test multi-clients avant production

Avant de basculer en mode production et d'inviter les 60 partenaires, les 2 templates doivent être testés **sur les 5 clients suivants**, en vérifiant à chaque fois que **l'email n'atterrit pas en spam** et que **le bouton reste cliquable** :

| # | Client | Point critique à contrôler |
|---|--------|-----------------------------|
| 1 | **Gmail web** (Chrome desktop) | Rendu bouton, absence de warning « sender unverified » |
| 2 | **Gmail mobile** (app Android) | Largeur adaptative, bouton tappable (min 44×44 px) |
| 3 | **Outlook web** | Tables-based layout (Outlook rend mal les CSS flexbox), liens en bleu par défaut |
| 4 | **Apple Mail iPhone** | Rendu iOS natif, pas d'overflow horizontal |
| 5 | **Yahoo Mail** web | Filtre anti-spam particulièrement strict — tester le taux d'arrivée |

**Check-list de test** :
- [ ] Email reçu en boîte de réception principale (pas spam / promotions / courriers indésirables)
- [ ] Sujet lisible, non tronqué
- [ ] Logo OIF visible
- [ ] Bouton centré, tappable au doigt sur mobile
- [ ] Lien de secours (copier-coller) présent et cliquable
- [ ] Mention « 1 heure de validité » clairement visible
- [ ] Signature SCS + email contact `projets@francophonie.org` présents
- [ ] Aucun mot en anglais visible
- [ ] Rendu acceptable en dark mode (clients qui l'inversent)
- [ ] Ouverture du lien → aboutit bien sur `/en-attente-de-validation` ou `/dashboard`

## Historique des versions

| Version | Date | Auteur | Changement |
|---------|------|--------|-----------|
| 1.0 | 2026-04-23 | Carlos H + Claude | Version initiale — archive des 2 templates Supabase par défaut customisés FR institutionnel. |
