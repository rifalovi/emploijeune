-- =============================================================================
-- v2.0.1.1 — Hotfix migration v2.0.1 : remplace gen_random_bytes par gen_random_uuid
-- -----------------------------------------------------------------------------
-- La migration 20260428100001 a échoué en prod avec :
--   ERROR: function gen_random_bytes(integer) does not exist (SQLSTATE 42883)
--
-- Cause : `gen_random_bytes()` appartient à l'extension pgcrypto qui n'est
-- pas dans le search_path par défaut sur Supabase managé.
--
-- Fix : utiliser `gen_random_uuid()` (natif PostgreSQL 13+, toujours
-- disponible). Pour le hash bcrypt du mot de passe temporaire, on tente
-- `crypt() + gen_salt('bf')` non-qualifié, puis `extensions.crypt(...)`,
-- puis fallback NULL (l'utilisateur passera de toute façon par
-- « Mot de passe oublié » qui régénère un hash valide).
--
-- Cette migration est idempotente — elle peut être appliquée après l'échec
-- de la migration 20260428100001 sans dommage.
-- =============================================================================

DO $$
DECLARE
  v_rifalovi_user_id UUID;
  v_carlos_uid       UUID;
  v_count            INTEGER;
  v_mdp_temp         TEXT;
  v_encrypted        TEXT;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 1. Provisionnement de rifalovi@gmail.com en super_admin
  -- ─────────────────────────────────────────────────────────────────────

  SELECT id INTO v_rifalovi_user_id
  FROM auth.users
  WHERE lower(email) = 'rifalovi@gmail.com'
  LIMIT 1;

  IF v_rifalovi_user_id IS NULL THEN
    -- Mot de passe temporaire : 32 chars hex via gen_random_uuid (natif PG 13+).
    -- Carlos passera par « Mot de passe oublié » pour fixer son vrai mdp.
    v_mdp_temp := replace(gen_random_uuid()::text, '-', '');

    -- Hashage bcrypt avec triple fallback :
    --   1. extensions.crypt() / extensions.gen_salt() qualified (Supabase standard,
    --      pgcrypto est installé dans le schema `extensions`)
    --   2. crypt() / gen_salt() unqualified (si search_path inclut extensions)
    --   3. NULL (l'utilisateur passe par « Mot de passe oublié » — pas de blocage)
    --
    -- Le triple fallback est défensif : selon la version Supabase et le
    -- search_path de la session migration, l'une ou l'autre forme peut être
    -- bloquée. EXECUTE permet d'isoler chaque tentative dans un sous-bloc.
    v_encrypted := NULL;
    BEGIN
      EXECUTE 'SELECT extensions.crypt($1, extensions.gen_salt(''bf''))'
        INTO v_encrypted USING v_mdp_temp;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'SELECT crypt($1, gen_salt(''bf''))'
          INTO v_encrypted USING v_mdp_temp;
      EXCEPTION WHEN OTHERS THEN
        v_encrypted := NULL;
        RAISE NOTICE 'pgcrypto indisponible — encrypted_password = NULL. Utilisez « Mot de passe oublié » sur rifalovi@gmail.com pour définir un mot de passe.';
      END;
    END;

    v_rifalovi_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_rifalovi_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'rifalovi@gmail.com',
      v_encrypted,
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('cree_par_migration', 'v2.0.1.1', 'mdp_temporaire', TRUE),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_rifalovi_user_id,
      v_rifalovi_user_id::text,
      jsonb_build_object(
        'sub', v_rifalovi_user_id::text,
        'email', 'rifalovi@gmail.com',
        'email_verified', TRUE
      ),
      'email',
      NULL,
      NOW(),
      NOW()
    );

    RAISE NOTICE 'rifalovi@gmail.com créé dans auth.users (UUID = %). Mot de passe à définir via « Mot de passe oublié ».', v_rifalovi_user_id;
  ELSE
    RAISE NOTICE 'rifalovi@gmail.com existe déjà dans auth.users (UUID = %).', v_rifalovi_user_id;
  END IF;

  -- Profil public.utilisateurs : super_admin (idempotent)
  SELECT COUNT(*) INTO v_count
  FROM public.utilisateurs
  WHERE user_id = v_rifalovi_user_id AND deleted_at IS NULL;

  IF v_count = 0 THEN
    INSERT INTO public.utilisateurs (
      user_id,
      nom_complet,
      role,
      organisation_id,
      actif,
      statut_validation,
      created_at,
      updated_at
    ) VALUES (
      v_rifalovi_user_id,
      'Carlos HOUNSINOU (super_admin)',
      'super_admin',
      NULL,
      TRUE,
      'valide',
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Profil rifalovi@gmail.com inséré en super_admin.';
  ELSE
    UPDATE public.utilisateurs
    SET role = 'super_admin', actif = TRUE, statut_validation = 'valide', updated_at = NOW()
    WHERE user_id = v_rifalovi_user_id AND deleted_at IS NULL AND role <> 'super_admin';
    RAISE NOTICE 'Profil rifalovi@gmail.com vérifié en super_admin (mis à jour si besoin).';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 2. Rétrogradation de carlos.hounsinou@francophonie.org → admin_scs
  -- ─────────────────────────────────────────────────────────────────────

  SELECT id INTO v_carlos_uid
  FROM auth.users
  WHERE lower(email) = 'carlos.hounsinou@francophonie.org'
  LIMIT 1;

  IF v_carlos_uid IS NULL THEN
    RAISE NOTICE 'carlos.hounsinou@francophonie.org introuvable dans auth.users — aucune rétrogradation effectuée.';
  ELSE
    UPDATE public.utilisateurs
    SET role = 'admin_scs', updated_at = NOW()
    WHERE user_id = v_carlos_uid
      AND deleted_at IS NULL
      AND role = 'super_admin';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      RAISE NOTICE 'carlos.hounsinou@francophonie.org : aucun changement (déjà admin_scs ou autre rôle).';
    ELSE
      RAISE NOTICE 'carlos.hounsinou@francophonie.org rétrogradé super_admin → admin_scs (% ligne).', v_count;
    END IF;
  END IF;
END;
$$;
