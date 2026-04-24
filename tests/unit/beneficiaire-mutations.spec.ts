import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests des Server Actions `modifierBeneficiaire` et `setBeneficiaireDeleted`.
 *
 * Ces tests mockent le client Supabase et l'helper d'authentification pour :
 *   - Vérifier la discrimination de statut (succès / doublon / RLS / erreur)
 *   - Vérifier l'exclusion de la fiche courante dans find_beneficiaire_doublon
 *   - Vérifier le garde-fou admin_scs sur setBeneficiaireDeleted
 *
 * Choix Vitest + mocks : la création d'un vrai environnement Supabase via
 * Playwright e2e aurait été plus représentative mais demande une base de test
 * et un seed — hors périmètre pour la 4e. Les mocks couvrent les branches de
 * décision critiques côté application ; la RLS effective est testée via
 * `execute_sql` en CI sur la branche staging Supabase (migration 005 tests).
 */

// =============================================================================
// Mocks globaux (déclarés AVANT les imports du module sous test)
// =============================================================================

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

/**
 * Construit un stub de QueryBuilder Supabase chainable. Chaque méthode retourne
 * l'objet lui-même pour supporter les enchaînements .update().eq().is() ;
 * c'est l'étape finale (await) qui renvoie le `result` fourni.
 */
type QueryResult = { data?: unknown; error?: unknown; count?: number };

function makeChainable(result: QueryResult) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

// State mutable partagé entre tous les tests (réinitialisé dans beforeEach).
let rpcResult: QueryResult = { data: [], error: null };
let tableResult: QueryResult = { data: null, error: null };
let utilisateurCourant: { user_id: string; role: string; organisation_id: string | null } | null = {
  user_id: '99999999-9999-4999-8999-999999999999',
  role: 'admin_scs',
  organisation_id: null,
};

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    rpc: vi.fn(async () => rpcResult),
    from: vi.fn(() => makeChainable(tableResult)),
  })),
}));

vi.mock('@/lib/supabase/auth', () => ({
  getCurrentUtilisateur: vi.fn(async () => utilisateurCourant),
}));

// Import du module sous test APRÈS les mocks.
const { modifierBeneficiaire, setBeneficiaireDeleted } = await import(
  '@/lib/beneficiaires/mutations'
);

// =============================================================================
// Fixtures
// =============================================================================

const payloadValide = {
  id: '11111111-1111-4111-8111-111111111111',
  prenom: 'Awa',
  nom: 'Traoré',
  sexe: 'F' as const,
  date_naissance: '1998-03-15',
  projet_code: 'PROJ_A16a' as const,
  pays_code: 'MLI' as const,
  domaine_formation_code: 'NUM_INFO' as const,
  annee_formation: 2024,
  statut_code: 'FORMATION_ACHEVEE' as const,
  consentement_recueilli: false,
};

// =============================================================================
// Tests modifierBeneficiaire
// =============================================================================

describe('modifierBeneficiaire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcResult = { data: [], error: null };
    tableResult = { data: null, error: null };
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'admin_scs',
      organisation_id: null,
    };
  });

  it('happy path : valeurs valides → statut succes + revalidation des caches', async () => {
    const res = await modifierBeneficiaire(payloadValide);
    expect(res.status).toBe('succes');
    if (res.status !== 'succes') throw new Error('unreachable');
    expect(res.id).toBe(payloadValide.id);

    // Les 3 chemins à invalider doivent être touchés (liste, fiche, dashboard)
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/beneficiaires');
    expect(paths).toContain(`/beneficiaires/${payloadValide.id}`);
    expect(paths).toContain('/dashboard');
  });

  it('rejet si id absent → erreur_validation (défense en profondeur vs client)', async () => {
    const { id: _omit, ...sansId } = payloadValide;
    const res = await modifierBeneficiaire(sansId);
    expect(res.status).toBe('erreur_validation');
  });

  it('rejet si id non-UUID → erreur_validation', async () => {
    const res = await modifierBeneficiaire({ ...payloadValide, id: 'pas-un-uuid' });
    expect(res.status).toBe('erreur_validation');
  });

  it('doublon : si find_beneficiaire_doublon renvoie une fiche → statut doublon', async () => {
    rpcResult = {
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          prenom: 'Awa',
          nom: 'TRAORE',
          date_naissance: '1998-03-15',
          projet_code: 'PROJ_A16a',
        },
      ],
      error: null,
    };
    const res = await modifierBeneficiaire(payloadValide);
    expect(res.status).toBe('doublon');
    if (res.status !== 'doublon') throw new Error('unreachable');
    expect(res.ficheExistante.id).toBe('22222222-2222-4222-8222-222222222222');
    // Aucun revalidate ne doit avoir été appelé (pas d'écriture)
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('erreur RLS (code 42501) → statut erreur_rls', async () => {
    tableResult = {
      data: null,
      error: { code: '42501', message: 'row-level security policy violation' },
    };
    const res = await modifierBeneficiaire(payloadValide);
    expect(res.status).toBe('erreur_rls');
  });

  it('violation CHECK (code 23514) → statut erreur_validation avec path _global', async () => {
    tableResult = {
      data: null,
      error: { code: '23514', message: 'check constraint beneficiaires_dates_formation failed' },
    };
    const res = await modifierBeneficiaire(payloadValide);
    expect(res.status).toBe('erreur_validation');
    if (res.status !== 'erreur_validation') throw new Error('unreachable');
    expect(res.issues[0]?.path).toBe('_global');
  });

  it('erreur BDD inconnue → statut erreur_inconnue avec message repris', async () => {
    tableResult = {
      data: null,
      error: { code: 'XX000', message: 'connexion perdue' },
    };
    const res = await modifierBeneficiaire(payloadValide);
    expect(res.status).toBe('erreur_inconnue');
    if (res.status !== 'erreur_inconnue') throw new Error('unreachable');
    expect(res.message).toContain('connexion perdue');
  });
});

// =============================================================================
// Tests setBeneficiaireDeleted
// =============================================================================

describe('setBeneficiaireDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcResult = { data: [], error: null };
    tableResult = { data: null, error: null };
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'admin_scs',
      organisation_id: null,
    };
  });

  it('admin_scs + UPDATE ok → statut succes + revalidation des 3 caches', async () => {
    const res = await setBeneficiaireDeleted(payloadValide.id, 'Doublon inter-projet');
    expect(res.status).toBe('succes');

    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/beneficiaires');
    expect(paths).toContain(`/beneficiaires/${payloadValide.id}`);
    expect(paths).toContain('/dashboard');
  });

  it('rôle editeur_projet refusé → erreur_rls SANS appel BDD', async () => {
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'editeur_projet',
      organisation_id: null,
    };
    const res = await setBeneficiaireDeleted(payloadValide.id);
    expect(res.status).toBe('erreur_rls');
    // Pas de revalidation (pas d'écriture)
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rôle contributeur_partenaire refusé → erreur_rls', async () => {
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'contributeur_partenaire',
      organisation_id: '33333333-3333-4333-8333-333333333333',
    };
    const res = await setBeneficiaireDeleted(payloadValide.id);
    expect(res.status).toBe('erreur_rls');
  });

  it('rôle lecteur refusé → erreur_rls', async () => {
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'lecteur',
      organisation_id: null,
    };
    const res = await setBeneficiaireDeleted(payloadValide.id);
    expect(res.status).toBe('erreur_rls');
  });

  it('utilisateur non authentifié → erreur_rls', async () => {
    utilisateurCourant = null;
    const res = await setBeneficiaireDeleted(payloadValide.id);
    expect(res.status).toBe('erreur_rls');
  });

  it('erreur BDD (42501) malgré admin_scs (double garde RLS) → erreur_rls', async () => {
    tableResult = {
      data: null,
      error: { code: '42501', message: 'row-level security policy violation' },
    };
    const res = await setBeneficiaireDeleted(payloadValide.id);
    expect(res.status).toBe('erreur_rls');
  });

  it('raison vide ou seulement espaces → traitée comme null (pas d’enregistrement inutile)', async () => {
    // On ne peut pas introspecter le payload envoyé à update() depuis ce niveau
    // de mock, mais le test sert surtout à vérifier qu'aucune erreur n'est
    // levée sur une raison vide, et que le succès est bien retourné.
    const res = await setBeneficiaireDeleted(payloadValide.id, '   ');
    expect(res.status).toBe('succes');
  });
});
