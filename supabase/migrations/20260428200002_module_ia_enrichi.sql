-- =============================================================================
-- v2.2.0 — Module IA enrichi : conversations, messages, base de connaissance
-- -----------------------------------------------------------------------------
-- 3 nouvelles tables :
--   • conversations_ia      : sessions de chat utilisateur (titre auto-généré)
--   • messages_ia           : historique conservé (chaque user/assistant turn)
--   • base_connaissance     : notes super_admin injectées dans le contexte IA
--
-- RLS strict :
--   • conversations / messages : un utilisateur ne voit QUE ses propres
--     conversations (filtre user_id = auth.uid()).
--   • base_connaissance : visible par tous les rôles ayant le module IA actif
--     (RPC module_ia_actif_pour_courant), modifiable UNIQUEMENT par super_admin.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. conversations_ia
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre TEXT,
  resume TEXT,
  archive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_ia_user_recent
  ON public.conversations_ia(user_id, updated_at DESC)
  WHERE archive = FALSE;

COMMENT ON TABLE public.conversations_ia IS
  'Sessions de chat assistant IA. Une conversation = N messages user/assistant. Titre auto-généré par Claude.';

ALTER TABLE public.conversations_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_ia_self ON public.conversations_ia;
CREATE POLICY conversations_ia_self ON public.conversations_ia
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. messages_ia
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations_ia(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  contenu TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_ia_conv_chrono
  ON public.messages_ia(conversation_id, created_at);

COMMENT ON TABLE public.messages_ia IS
  'Messages individuels d''une conversation IA. metadata JSONB = tokens utilisés, sources citées, etc.';

ALTER TABLE public.messages_ia ENABLE ROW LEVEL SECURITY;

-- RLS : on filtre par conversation appartenant à l'utilisateur authentifié.
DROP POLICY IF EXISTS messages_ia_self ON public.messages_ia;
CREATE POLICY messages_ia_self ON public.messages_ia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations_ia c
      WHERE c.id = messages_ia.conversation_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations_ia c
      WHERE c.id = messages_ia.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. base_connaissance
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.base_connaissance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('note_analyse', 'document_pdf', 'document_word', 'image', 'texte_libre')),
  contenu_text TEXT,
  fichier_url TEXT,
  fichier_extracted_text TEXT,
  source_conversation_id UUID REFERENCES public.conversations_ia(id) ON DELETE SET NULL,
  ajoute_par UUID NOT NULL REFERENCES auth.users(id),
  ajoute_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_base_connaissance_actives
  ON public.base_connaissance(ajoute_at DESC)
  WHERE archive = FALSE;

CREATE INDEX IF NOT EXISTS idx_base_connaissance_tags
  ON public.base_connaissance USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_base_connaissance_recherche
  ON public.base_connaissance USING GIN(
    to_tsvector('french',
      coalesce(titre, '') || ' ' ||
      coalesce(contenu_text, '') || ' ' ||
      coalesce(fichier_extracted_text, '')
    )
  );

COMMENT ON TABLE public.base_connaissance IS
  'Base de connaissance institutionnelle alimentée par le super_admin. Injectée dans le contexte de Claude pour les utilisateurs ayant le module IA actif.';

ALTER TABLE public.base_connaissance ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs ayant le module IA actif pour leur rôle.
DROP POLICY IF EXISTS base_connaissance_lecture ON public.base_connaissance;
CREATE POLICY base_connaissance_lecture ON public.base_connaissance
  FOR SELECT TO authenticated
  USING (
    archive = FALSE
    AND public.module_ia_actif_pour_courant()
  );

-- Écriture : super_admin uniquement.
DROP POLICY IF EXISTS base_connaissance_ecriture ON public.base_connaissance;
CREATE POLICY base_connaissance_ecriture ON public.base_connaissance
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC : créer une conversation et y ajouter un message en une transaction
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.creer_conversation_ia(
  p_titre TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non_authentifie';
  END IF;
  INSERT INTO public.conversations_ia(user_id, titre)
  VALUES (v_uid, p_titre)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.creer_conversation_ia(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC : recherche full-text dans la base de connaissance
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rechercher_base_connaissance(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  titre TEXT,
  type TEXT,
  contenu TEXT,
  pertinence REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bc.id,
    bc.titre,
    bc.type,
    COALESCE(bc.contenu_text, bc.fichier_extracted_text, '') AS contenu,
    ts_rank(
      to_tsvector('french',
        coalesce(bc.titre, '') || ' ' ||
        coalesce(bc.contenu_text, '') || ' ' ||
        coalesce(bc.fichier_extracted_text, '')
      ),
      plainto_tsquery('french', p_query)
    ) AS pertinence
  FROM public.base_connaissance bc
  WHERE bc.archive = FALSE
    AND public.module_ia_actif_pour_courant()
    AND (
      p_query IS NULL OR length(trim(p_query)) = 0
      OR to_tsvector('french',
           coalesce(bc.titre, '') || ' ' ||
           coalesce(bc.contenu_text, '') || ' ' ||
           coalesce(bc.fichier_extracted_text, '')
         ) @@ plainto_tsquery('french', p_query)
    )
  ORDER BY pertinence DESC, bc.ajoute_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION public.rechercher_base_connaissance(TEXT, INTEGER) TO authenticated;
