-- =============================================================================
-- Migration 028-fix — Correction RLS analyses_indicateurs
-- -----------------------------------------------------------------------------
-- Bug : la migration 028 (20260511100001) référençait `u.id = auth.uid()` dans
-- les 4 politiques super_admin alors que `utilisateurs.id` est l'UUID de la
-- ligne, pas l'UUID auth. La bonne colonne est `utilisateurs.user_id` qui
-- pointe vers `auth.users.id` (cf. migration initiale 20260422000001 et
-- 20260422000002_rls_policies.sql).
--
-- Conséquence : aucun super_admin ne pouvait insérer/lire/modifier/supprimer
-- d'analyse — la jointure échouait silencieusement, donc EXISTS retournait
-- FALSE, donc RLS refusait avec "new row violates row-level security policy".
--
-- Ce fix DROP/CREATE les 4 politiques avec la bonne jointure. Idempotent
-- grâce à DROP IF EXISTS (replay safe).
--
-- La politique "lecture_analyses_publiees" est inchangée (pas de jointure).
-- =============================================================================

DROP POLICY IF EXISTS "super_admin_lecture_complete" ON public.analyses_indicateurs;
DROP POLICY IF EXISTS "super_admin_insert"           ON public.analyses_indicateurs;
DROP POLICY IF EXISTS "super_admin_update"           ON public.analyses_indicateurs;
DROP POLICY IF EXISTS "super_admin_delete"           ON public.analyses_indicateurs;

CREATE POLICY "super_admin_lecture_complete"
  ON public.analyses_indicateurs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE POLICY "super_admin_insert"
  ON public.analyses_indicateurs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE POLICY "super_admin_update"
  ON public.analyses_indicateurs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE POLICY "super_admin_delete"
  ON public.analyses_indicateurs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.user_id = auth.uid() AND u.role = 'super_admin'
    )
  );
