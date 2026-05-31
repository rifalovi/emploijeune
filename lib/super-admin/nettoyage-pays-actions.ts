'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

/**
 * Server Actions — Resolution des beneficiaires pays_code = 'ZZZ'.
 *
 * Phase 2.4 du chantier qualite de donnees. Les RPC cote BDD font un
 * second filtrage defensif (is_admin_scs) en defense-in-depth.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type BeneficiaireZzz = {
  id: string;
  prenom: string;
  nom: string;
  sexe: string | null;
  tranche_age_declaree: string | null;
  projet_code: string;
  annee_formation: number | null;
  annee_naissance: number | null;
  created_at: string;
};

export type PaysMajoritaire = {
  projet_code: string;
  pays_code: string;
  libelle_fr: string;
  n: number;
  pct: number;
};

export type ResumeProjet = {
  projet_code: string;
  total: number;
  sans_tranche: number;
  nom_inconnu: number;
  pays_majoritaire: PaysMajoritaire | null;
};

type Resultat<T = void> = T extends void
  ? { status: 'succes' } | { status: 'erreur'; message: string }
  : { status: 'succes'; data: T } | { status: 'erreur'; message: string };

// ── Guard ────────────────────────────────────────────────────────────────────

async function exigerAdminScs(): Promise<
  | { utilisateur: NonNullable<Awaited<ReturnType<typeof getCurrentUtilisateur>>> }
  | { erreur: string }
> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur) return { erreur: 'non_authentifie' };
  if (!['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { erreur: 'reserve_admin' };
  }
  return { utilisateur };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listerBeneficiairesZzz(): Promise<BeneficiaireZzz[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_beneficiaires_zzz' as never);

  // Fallback: requete directe si la RPC n'existe pas
  if (error) {
    const { data: rows } = await supabase
      .from('beneficiaires')
      .select('id, prenom, nom, sexe, tranche_age_declaree, projet_code, annee_formation, date_naissance, created_at')
      .eq('pays_code', 'ZZZ')
      .is('deleted_at', null)
      .order('projet_code')
      .order('created_at');

    return (rows ?? []).map((r) => ({
      ...r,
      annee_naissance: r.date_naissance
        ? new Date(r.date_naissance).getFullYear()
        : null,
    }));
  }

  return (data as BeneficiaireZzz[]) ?? [];
}

export async function getPaysMajoritaireParProjet(): Promise<PaysMajoritaire[]> {
  const supabase = await createSupabaseServerClient();

  // Projets concernes par les ZZZ
  const projets = ['PROJ_A14', 'PROJ_A16a', 'PROJ_A19'];

  const { data: rows } = await supabase
    .from('beneficiaires')
    .select('projet_code, pays_code')
    .in('projet_code', projets)
    .neq('pays_code', 'ZZZ')
    .not('pays_code', 'is', null)
    .is('deleted_at', null);

  if (!rows || rows.length === 0) return [];

  // Compter par projet + pays cote client (le SDK ne supporte pas GROUP BY)
  const compteurs = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!compteurs.has(r.projet_code)) compteurs.set(r.projet_code, new Map());
    const m = compteurs.get(r.projet_code)!;
    m.set(r.pays_code, (m.get(r.pays_code) ?? 0) + 1);
  }

  // Recuperer les libelles pays
  const { data: pays } = await supabase
    .from('pays')
    .select('code_iso, libelle_fr')
    .eq('actif', true);
  const paysMap = new Map((pays ?? []).map((p) => [p.code_iso, p.libelle_fr]));

  const result: PaysMajoritaire[] = [];
  for (const [projet, paysCompteur] of compteurs) {
    const totalProjet = Array.from(paysCompteur.values()).reduce((a, b) => a + b, 0);
    let topPays = '';
    let topN = 0;
    for (const [code, n] of paysCompteur) {
      if (n > topN) { topPays = code; topN = n; }
    }
    result.push({
      projet_code: projet,
      pays_code: topPays,
      libelle_fr: paysMap.get(topPays) ?? topPays,
      n: topN,
      pct: Math.round((1000 * topN) / totalProjet) / 10,
    });
  }

  return result;
}

export async function getResumeProjets(): Promise<ResumeProjet[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from('beneficiaires')
    .select('id, projet_code, tranche_age_declaree, nom')
    .eq('pays_code', 'ZZZ')
    .is('deleted_at', null);

  if (!rows || rows.length === 0) return [];

  const paysMaj = await getPaysMajoritaireParProjet();
  const paysMajMap = new Map(paysMaj.map((p) => [p.projet_code, p]));

  const groupes = new Map<string, { total: number; sans_tranche: number; nom_inconnu: number }>();
  for (const r of rows) {
    if (!groupes.has(r.projet_code)) {
      groupes.set(r.projet_code, { total: 0, sans_tranche: 0, nom_inconnu: 0 });
    }
    const g = groupes.get(r.projet_code)!;
    g.total++;
    if (!r.tranche_age_declaree) g.sans_tranche++;
    if (r.nom === 'Nom inconnu') g.nom_inconnu++;
  }

  return Array.from(groupes.entries())
    .map(([projet, stats]) => ({
      projet_code: projet,
      ...stats,
      pays_majoritaire: paysMajMap.get(projet) ?? null,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function listerPays(): Promise<{ code_iso: string; libelle_fr: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('pays')
    .select('code_iso, libelle_fr')
    .eq('actif', true)
    .neq('code_iso', 'ZZZ')
    .order('libelle_fr');
  return data ?? [];
}

// ── Mutations ────────────────────────────────────────────────────────────────

const corrigerSchema = z.object({
  beneficiaireId: z.string().uuid(),
  nouveauPaysCode: z.string().length(3),
});

export async function corrigerPays(
  beneficiaireId: string,
  nouveauPaysCode: string,
): Promise<Resultat> {
  const garde = await exigerAdminScs();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = corrigerSchema.safeParse({ beneficiaireId, nouveauPaysCode });
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC pas encore dans les types generees
  const { data, error } = await (supabase.rpc as any)('corriger_pays_beneficiaire', {
    p_beneficiaire_id: parsed.data.beneficiaireId,
    p_nouveau_pays_code: parsed.data.nouveauPaysCode,
  });

  if (error) return { status: 'erreur', message: error.message };
  if (data === false) return { status: 'erreur', message: 'Beneficiaire non trouve ou deja corrige.' };

  revalidatePath('/super-admin/nettoyage-donnees/pays-inconnus');
  return { status: 'succes' };
}

const corrigerBulkSchema = z.object({
  beneficiaireIds: z.array(z.string().uuid()).min(1).max(500),
  nouveauPaysCode: z.string().length(3),
});

export async function corrigerPaysBulk(
  beneficiaireIds: string[],
  nouveauPaysCode: string,
): Promise<Resultat<{ corriges: number; alertes_resolues: number }>> {
  const garde = await exigerAdminScs();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const parsed = corrigerBulkSchema.safeParse({ beneficiaireIds, nouveauPaysCode });
  if (!parsed.success) return { status: 'erreur', message: 'Payload invalide.' };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('corriger_pays_bulk', {
    p_beneficiaire_ids: parsed.data.beneficiaireIds,
    p_nouveau_pays_code: parsed.data.nouveauPaysCode,
  });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/nettoyage-donnees/pays-inconnus');
  return { status: 'succes', data: data as { corriges: number; alertes_resolues: number } };
}

export async function ignorerAlerte(
  beneficiaireId: string,
  note?: string,
): Promise<Resultat> {
  const garde = await exigerAdminScs();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('ignorer_alerte_pays_zzz', {
    p_beneficiaire_id: beneficiaireId,
    p_note: note ?? 'Donnees insuffisantes pour resoudre',
  });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/nettoyage-donnees/pays-inconnus');
  return { status: 'succes' };
}

export async function ignorerAlertesBulk(
  beneficiaireIds: string[],
  note?: string,
): Promise<Resultat<{ ignores: number }>> {
  const garde = await exigerAdminScs();
  if ('erreur' in garde) return { status: 'erreur', message: garde.erreur };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('ignorer_alertes_pays_zzz_bulk', {
    p_beneficiaire_ids: beneficiaireIds,
    p_note: note ?? 'Donnees insuffisantes pour resoudre',
  });

  if (error) return { status: 'erreur', message: error.message };

  revalidatePath('/super-admin/nettoyage-donnees/pays-inconnus');
  return { status: 'succes', data: { ignores: data as number } };
}
