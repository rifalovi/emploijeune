-- =============================================================================
-- Migration — Élargir la gestion des documents publics à admin_scs
-- -----------------------------------------------------------------------------
-- Demande Carlos : l'admin_scs doit pouvoir uploader/supprimer les PDF
-- depuis le back-office, pas seulement le super_admin. On élargit les RLS
-- de la table `documents_publics` et du bucket `documents-publics`.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Storage : ouverture à admin_scs
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS documents_publics_storage_insert ON storage.objects;
CREATE POLICY documents_publics_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents-publics'
    AND (public.is_super_admin() OR public.is_admin_scs())
  );

DROP POLICY IF EXISTS documents_publics_storage_update ON storage.objects;
CREATE POLICY documents_publics_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents-publics'
    AND (public.is_super_admin() OR public.is_admin_scs())
  )
  WITH CHECK (
    bucket_id = 'documents-publics'
    AND (public.is_super_admin() OR public.is_admin_scs())
  );

DROP POLICY IF EXISTS documents_publics_storage_delete ON storage.objects;
CREATE POLICY documents_publics_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents-publics'
    AND (public.is_super_admin() OR public.is_admin_scs())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS table : ouverture à admin_scs
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS documents_publics_ecriture_super_admin ON public.documents_publics;
DROP POLICY IF EXISTS documents_publics_ecriture_admin ON public.documents_publics;
CREATE POLICY documents_publics_ecriture_admin
  ON public.documents_publics FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_admin_scs())
  WITH CHECK (public.is_super_admin() OR public.is_admin_scs());
