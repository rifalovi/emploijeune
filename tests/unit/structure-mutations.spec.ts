import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests des Server Actions `creerStructure` et `modifierStructure`.
 *
 * Pattern miroir de `beneficiaire-mutations.spec.ts` (Étape 4d) : on mocke
 * le client Supabase via un QueryBuilder chainable pour vérifier la
 * discrimination de statut côté application (succes / doublon / RLS / erreur).
 *
 * La RLS effective + la fonction SQL `find_structure_doublon` sont testées
 * en intégration via `execute_sql` sur la branche staging Supabase (pas
 * dans ces tests unitaires).
 */

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

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

let rpcResult: QueryResult = { data: [], error: null };
let tableResult: QueryResult = { data: null, error: null };
let utilisateurCourant: {
  user_id: string;
  role: string;
  organisation_id: string | null;
} | null = {
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

const { creerStructure, modifierStructure } = await import('@/lib/structures/mutations');

const payloadValide = {
  nom_structure: 'COOPAGRO',
  type_structure_code: 'COOP' as const,
  secteur_activite_code: 'AGR_SYL_PCH' as const,
  statut_creation: 'creation' as const,
  projet_code: 'PROJ_A16a' as const,
  pays_code: 'MLI' as const,
  porteur_nom: 'Traoré',
  porteur_sexe: 'F' as const,
  annee_appui: 2024,
  nature_appui_code: 'MATERIEL' as const,
  consentement_recueilli: false,
};

describe('creerStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcResult = { data: [], error: null };
    tableResult = { data: { id: '11111111-1111-4111-8111-111111111111' }, error: null };
    utilisateurCourant = {
      user_id: '99999999-9999-4999-8999-999999999999',
      role: 'admin_scs',
      organisation_id: null,
    };
  });

  it('happy path : valeurs valides → statut succes + revalidation des caches', async () => {
    const res = await creerStructure(payloadValide);
    expect(res.status).toBe('succes');
    if (res.status !== 'succes') throw new Error('unreachable');
    expect(res.id).toBe('11111111-1111-4111-8111-111111111111');
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/structures');
    expect(paths).toContain('/dashboard');
  });

  it('rejet si nom_structure vide → erreur_validation', async () => {
    const res = await creerStructure({ ...payloadValide, nom_structure: '' });
    expect(res.status).toBe('erreur_validation');
  });

  it('doublon : si find_structure_doublon renvoie une fiche → statut doublon', async () => {
    rpcResult = {
      data: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          nom_structure: 'COOPAGRO',
          pays_code: 'MLI',
          projet_code: 'PROJ_A16a',
          similarity_score: 0.95,
        },
      ],
      error: null,
    };
    const res = await creerStructure(payloadValide);
    expect(res.status).toBe('doublon');
    if (res.status !== 'doublon') throw new Error('unreachable');
    expect(res.ficheExistante.similarity_score).toBe(0.95);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('erreur RLS (code 42501) → statut erreur_rls', async () => {
    tableResult = {
      data: null,
      error: { code: '42501', message: 'row-level security policy violation' },
    };
    const res = await creerStructure(payloadValide);
    expect(res.status).toBe('erreur_rls');
  });

  it('violation CHECK (code 23514, ex. RGPD) → erreur_validation _global', async () => {
    tableResult = {
      data: null,
      error: { code: '23514', message: 'check constraint chk_structures_rgpd failed' },
    };
    const res = await creerStructure(payloadValide);
    expect(res.status).toBe('erreur_validation');
    if (res.status !== 'erreur_validation') throw new Error('unreachable');
    expect(res.issues[0]?.path).toBe('_global');
  });

  it('contrainte unique (23505) → erreur_inconnue avec message dédié', async () => {
    tableResult = {
      data: null,
      error: { code: '23505', message: 'duplicate key violation' },
    };
    const res = await creerStructure(payloadValide);
    expect(res.status).toBe('erreur_inconnue');
    if (res.status !== 'erreur_inconnue') throw new Error('unreachable');
    expect(res.message).toContain('hors de votre périmètre');
  });

  it('rejet si nature=SUBVENTION sans montant → erreur_validation montant_appui', async () => {
    const res = await creerStructure({ ...payloadValide, nature_appui_code: 'SUBVENTION' });
    expect(res.status).toBe('erreur_validation');
    if (res.status !== 'erreur_validation') throw new Error('unreachable');
    expect(res.issues.some((i) => i.path === 'montant_appui')).toBe(true);
  });

  it('rejet si porteur < 18 ans → erreur_validation porteur_date_naissance', async () => {
    const aujourdhui = new Date();
    const ilYa10Ans = new Date(aujourdhui.getFullYear() - 10, 0, 1);
    const res = await creerStructure({
      ...payloadValide,
      porteur_date_naissance: ilYa10Ans.toISOString().slice(0, 10),
    });
    expect(res.status).toBe('erreur_validation');
    if (res.status !== 'erreur_validation') throw new Error('unreachable');
    expect(res.issues.some((i) => i.path === 'porteur_date_naissance')).toBe(true);
  });
});

describe('modifierStructure', () => {
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

  const payloadEdition = {
    ...payloadValide,
    id: '11111111-1111-4111-8111-111111111111',
  };

  it('happy path édition → statut succes + revalidation des 3 caches', async () => {
    const res = await modifierStructure(payloadEdition);
    expect(res.status).toBe('succes');
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/structures');
    expect(paths).toContain(`/structures/${payloadEdition.id}`);
    expect(paths).toContain('/dashboard');
  });

  it('rejet si id absent → erreur_validation', async () => {
    const { id: _omit, ...sansId } = payloadEdition;
    const res = await modifierStructure(sansId);
    expect(res.status).toBe('erreur_validation');
  });

  it('rejet si id non-UUID → erreur_validation', async () => {
    const res = await modifierStructure({ ...payloadEdition, id: 'pas-un-uuid' });
    expect(res.status).toBe('erreur_validation');
  });

  it('exclusion id : doublon trouvé sur soi-même n\u2019est pas remonté (RPC simulée renvoie []) → succes', async () => {
    // La fonction SQL applique p_exclude_id ; ici on simule qu'elle n'a
    // remonté aucun doublon (le RPC est appelé avec exclude_id = id courant).
    rpcResult = { data: [], error: null };
    const res = await modifierStructure(payloadEdition);
    expect(res.status).toBe('succes');
  });

  it('erreur RLS (42501) → erreur_rls', async () => {
    tableResult = {
      data: null,
      error: { code: '42501', message: 'row-level security policy violation' },
    };
    const res = await modifierStructure(payloadEdition);
    expect(res.status).toBe('erreur_rls');
  });
});
