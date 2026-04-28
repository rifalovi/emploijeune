-- =============================================================================
-- v2.0.1 — Inversion des rôles super_admin Carlos
-- -----------------------------------------------------------------------------
-- Décision Carlos : séparer son compte de démo (carlos.hounsinou@francophonie.org)
-- de son compte super_admin réel (rifalovi@gmail.com).
--
-- Avant :
--   carlos.hounsinou@francophonie.org → super_admin (sprint v2.0.0)
--
-- Après :
--   carlos.hounsinou@francophonie.org → admin_scs (compte démo institutionnel)
--   rifalovi@gmail.com               → super_admin (compte réel, modules / archivage)
--
-- Stratégie :
--   1. Si rifalovi@gmail.com existe déjà dans auth.users (compte préexistant ou
--      créé manuellement par Carlos via Supabase Studio), on s'assure qu'il a
--      une ligne public.utilisateurs avec role='super_admin'. Sinon, on
--      provisionne entièrement (auth.users avec mot de passe temporaire bcrypté
--      + public.utilisateurs).
--   2. Carlos doit ensuite utiliser le flux « Mot de passe oublié » pour
--      définir son vrai mot de passe (le mdp temporaire n'est jamais affiché).
--   3. Rétrograde carlos.hounsinou@francophonie.org de super_admin → admin_scs
--      (idempotent : ne fait rien si déjà admin_scs).
--
-- Toutes les opérations sont idempotentes — la migration peut être rejouée
-- sans dommage.
-- =============================================================================

DO $$
DECLARE
  v_rifalovi_user_id UUID;
  v_carlos_uid       UUID;
  v_count            INTEGER;
  v_mdp_temp         TEXT;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 1. Provisionnement de rifalovi@gmail.com en super_admin
  -- ─────────────────────────────────────────────────────────────────────

  SELECT id INTO v_rifalovi_user_id
  FROM auth.users
  WHERE lower(email) = 'rifalovi@gmail.com'
  LIMIT 1;

  IF v_rifalovi_user_id IS NULL THEN
    -- Création complète : auth.users + identities + public.utilisateurs.
    -- Mot de passe temporaire fort (32 chars hex) — Carlos passera par
    -- « Mot de passe oublié » pour définir son vrai mot de passe.
    v_rifalovi_user_id := gen_random_uuid();
    v_mdp_temp := encode(gen_random_bytes(16), 'hex');

    -- Insertion auth.users (schéma Supabase Auth standard, GoTrue compatible)
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
      crypt(v_mdp_temp, gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('cree_par_migration', 'v2.0.1', 'mdp_temporaire', TRUE),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Identité email (requis par Supabase Auth pour login email/password)
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

    RAISE NOTICE 'rifalovi@gmail.com créé dans auth.users (UUID = %). Mdp temporaire à réinitialiser via « Mot de passe oublié ».', v_rifalovi_user_id;
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
    RAISE NOTICE 'Profil rifalovi@gmail.com mis à jour en super_admin (si pas déjà).';
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

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. Activation_modules : on conserve activation IA pour super_admin
  -- ─────────────────────────────────────────────────────────────────────
  -- (Aucune action nécessaire : la ligne (assistant_ia, super_admin) reste
  -- TRUE de par le bootstrap initial de la migration v2.0.0. rifalovi
  -- héritera donc automatiquement de l'IA activée.)
END;
$$;
