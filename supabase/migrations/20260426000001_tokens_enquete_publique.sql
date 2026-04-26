-- =============================================================================
-- Étape 6.5c — Tokens d'enquête publique (saisie sans authentification)
-- -----------------------------------------------------------------------------
-- Permet à un bénéficiaire ou une structure de répondre à un questionnaire
-- via une URL `/enquetes/public/[token]` SANS authentification.
--
-- Workflow :
--   1. Un admin_scs ou un coordonnateur lance une vague d'enquête → génère
--      un token unique par cible et l'envoie par email (Étape 6.5d/6.5e).
--   2. Le destinataire clique sur le lien → la route publique valide le
--      token (existence, non expiré, non consommé) et affiche le formulaire.
--   3. À la soumission, la Server Action publique :
--      - valide à nouveau le token (anti-double-soumission)
--      - INSERT les N lignes reponses_enquetes (1 par indicateur)
--      - UPDATE le token : consomme_at = NOW(), session_enquete_id = <uuid>
--
-- Sécurité :
--   - Token = 32 caractères hex (128 bits d'entropie) — généré côté serveur
--   - Expiration : 30 jours par défaut, configurable par génération
--   - 1 seule réponse par token (consomme_at NULL → token consommable)
--   - Rate-limit applicatif côté middleware Next.js (5 req/min/IP)
--   - RLS : lecture/écriture autorisée via Server Action (service_role) UNIQUEMENT
--     côté serveur Next.js. Pas d'accès direct depuis le navigateur.
-- =============================================================================

CREATE TABLE public.tokens_enquete_publique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Token public lisible (32 chars hex). Index UNIQUE pour lookup rapide.
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{32}$'),

  -- Cible (bénéficiaire ou structure). Aligné sur la contrainte
  -- `chk_reponses_cible` de reponses_enquetes (un OU l'autre).
  cible_type TEXT NOT NULL CHECK (cible_type IN ('beneficiaire', 'structure')),
  beneficiaire_id UUID REFERENCES public.beneficiaires(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,

  -- Questionnaire (A pour bénéficiaire, B pour structure)
  questionnaire TEXT NOT NULL CHECK (questionnaire IN ('A', 'B')),

  -- Métadonnées de la vague d'enquête
  vague_enquete public.vague_enquete NOT NULL DEFAULT 'ponctuelle',
  canal_collecte public.canal_collecte NOT NULL DEFAULT 'email',
  projet_code TEXT REFERENCES public.projets(code),

  -- Cycle de vie
  expire_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  consomme_at TIMESTAMPTZ,
  session_enquete_id UUID, -- lien vers les réponses générées (post-soumission)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Garde-fou : exactement une cible
  CONSTRAINT chk_tokens_cible_unique CHECK (
    (cible_type = 'beneficiaire' AND beneficiaire_id IS NOT NULL AND structure_id IS NULL)
    OR (cible_type = 'structure' AND structure_id IS NOT NULL AND beneficiaire_id IS NULL)
  ),
  -- Garde-fou : cohérence questionnaire ↔ cible
  CONSTRAINT chk_tokens_questionnaire_cible CHECK (
    (cible_type = 'beneficiaire' AND questionnaire = 'A')
    OR (cible_type = 'structure' AND questionnaire = 'B')
  )
);

-- Index pour les patterns d'accès attendus
CREATE INDEX idx_tokens_expire ON public.tokens_enquete_publique(expire_at)
  WHERE consomme_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_tokens_beneficiaire ON public.tokens_enquete_publique(beneficiaire_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_tokens_structure ON public.tokens_enquete_publique(structure_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_tokens_session ON public.tokens_enquete_publique(session_enquete_id)
  WHERE session_enquete_id IS NOT NULL;

COMMENT ON TABLE public.tokens_enquete_publique IS
  'Tokens UUID pour la saisie publique d''enquête sans authentification (Étape 6.5c). 32 chars hex, expiration 30j, 1 seule réponse par token.';

-- RLS — lecture/écriture protégées : tout passe par Server Action service_role
-- (les routes publiques /enquetes/public/[token] ne lisent pas directement
--  cette table depuis le navigateur).
ALTER TABLE public.tokens_enquete_publique ENABLE ROW LEVEL SECURITY;

-- admin_scs : lecture + insertion + update (pour soft-delete)
CREATE POLICY tokens_admin_select ON public.tokens_enquete_publique
  FOR SELECT TO authenticated
  USING (public.is_admin_scs());
CREATE POLICY tokens_admin_insert ON public.tokens_enquete_publique
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_scs()
    OR public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
  );
CREATE POLICY tokens_admin_update ON public.tokens_enquete_publique
  FOR UPDATE TO authenticated
  USING (public.is_admin_scs())
  WITH CHECK (public.is_admin_scs());

-- editeur_projet / contributeur_partenaire : lecture des tokens qu'ils ont
-- créés (pour suivi du taux de consommation depuis l'UI à venir en V1.5).
CREATE POLICY tokens_creator_select ON public.tokens_enquete_publique
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND public.current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')
  );

-- Trigger updated_at non requis ici (pas de colonne updated_at — la table
-- est append-only sauf consomme_at qui se met une seule fois).
