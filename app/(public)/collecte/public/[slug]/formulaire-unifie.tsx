'use client';

/**
 * Formulaire unifié (Type 0) — wizard multi-étapes.
 *
 * Étapes :
 *   1. Catégorie (bénéficiaire / structure / acteur institutionnel)
 *   2. Identité (champs adaptés selon catégorie)
 *   3. Consentement RGPD + soumission
 *
 * Le répondant choisit sa catégorie, saisit son identité une seule fois,
 * puis soumet. Côté serveur, le routing se fait selon meta.categorie.
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { User, Building2, ChevronLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { InfoLienPublic } from '@/lib/collecte-publique/actions';
import type { TrancheAgeOption } from './collecte-form';

// ── Types ────────────────────────────────────────────────────────────────────

type Categorie = 'beneficiaire' | 'structure';

type Props = {
  lien: InfoLienPublic;
  isPending: boolean;
  erreur: string;
  onSubmit: (d: Record<string, unknown>) => void;
  onSubmitEtNouveau: (d: Record<string, unknown>) => void;
  confirmationNouveau: boolean;
  tranchesAge?: TrancheAgeOption[];
};

const SEXE_VALUES = ['F', 'M', 'Autre'] as const;
const SEXE_LIBELLES: Record<string, string> = { F: 'Féminin', M: 'Masculin', Autre: 'Autre / Non précisé' };

// ── Composant principal ──────────────────────────────────────────────────────

export function FormulaireUnifie({
  lien,
  isPending,
  erreur,
  onSubmit,
  onSubmitEtNouveau,
  confirmationNouveau,
  tranchesAge = [],
}: Props) {
  const [etape, setEtape] = useState(0);
  const [categorie, setCategorie] = useState<Categorie | null>(null);

  const { register, handleSubmit, control, watch } = useForm({
    defaultValues: {
      // Bénéficiaire
      prenom: '',
      nom: '',
      sexe: '',
      tranche_age_declaree: '',
      // Structure
      nom_structure: '',
      type_structure: '',
      secteur_activite: '',
      porteur_nom: '',
      porteur_sexe: '',
      // Commun
      pays: lien.projet_code ? '' : '',
      consentement: false,
    },
  });

  const consentement = watch('consentement');

  const construireDonnees = (data: Record<string, unknown>): Record<string, unknown> => ({
    ...data,
    meta: { categorie, source: 'formulaire_unifie_type_0' },
    projet_code: lien.projet_code,
  });

  const soumettre = (data: Record<string, unknown>) => onSubmit(construireDonnees(data));
  const soumettreEtNouveau = (data: Record<string, unknown>) => onSubmitEtNouveau(construireDonnees(data));

  // ── Étape 0 : Choix de catégorie ──────────────────────────────────────

  if (etape === 0) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-slate-700">
          Quelle catégorie vous correspond ?
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            {
              id: 'beneficiaire' as Categorie,
              icon: User,
              titre: 'Je suis une personne',
              desc: 'Beneficiaire ayant recu une formation, un accompagnement ou un appui a l\'insertion professionnelle via l\'OIF.',
              couleur: '#5D0073',
            },
            {
              id: 'structure' as Categorie,
              icon: Building2,
              titre: 'Je represente une structure',
              desc: 'Organisation, entreprise ou association ayant beneficie d\'un appui (subvention, formation, accompagnement).',
              couleur: '#0198E9',
            },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setCategorie(opt.id); setEtape(1); }}
              className="flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-current hover:shadow-md"
              style={{ borderColor: categorie === opt.id ? opt.couleur : undefined, color: opt.couleur }}
            >
              <span
                className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: opt.couleur }}
              >
                <opt.icon className="size-5" />
              </span>
              <div>
                <span className="text-sm font-semibold text-slate-800">{opt.titre}</span>
                <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Étape 1 : Identité + données ──────────────────────────────────────

  if (etape === 1) {
    return (
      <form onSubmit={handleSubmit(soumettre)} className="space-y-6">
        {/* Indicateur de progression */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button type="button" onClick={() => setEtape(0)} className="flex items-center gap-1 hover:text-slate-700">
            <ChevronLeft className="size-3" /> Changer de catégorie
          </button>
          <span>Étape 2 / 2</span>
        </div>

        {/* Badge catégorie */}
        <div className="rounded-lg border bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-600">
          {categorie === 'beneficiaire' && 'Personne / Beneficiaire individuel'}
          {categorie === 'structure' && 'Structure / Organisation'}
        </div>

        {/* ── Champs bénéficiaire ──────────────────────────────────── */}
        {categorie === 'beneficiaire' && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom <span className="text-destructive">*</span></Label>
                  <Input {...register('prenom', { required: true })} placeholder="Prénom" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom <span className="text-destructive">*</span></Label>
                  <Input {...register('nom', { required: true })} placeholder="Nom" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sexe <span className="text-destructive">*</span></Label>
                  <Controller
                    name="sexe"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          {SEXE_VALUES.map((s) => (
                            <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tranche d&apos;âge</Label>
                  <Controller
                    name="tranche_age_declaree"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Facultatif" /></SelectTrigger>
                        <SelectContent>
                          {tranchesAge.length > 0 ? (
                            tranchesAge.map((t) => (
                              <SelectItem key={t.id} value={t.libelle}>
                                {t.libelle} ({t.categorie_oif})
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="jeune">Jeune (15–34 ans)</SelectItem>
                              <SelectItem value="adulte">Adulte (35 ans et +)</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Champs structure ─────────────────────────────────────── */}
        {categorie === 'structure' && (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Nom de la structure <span className="text-destructive">*</span></Label>
                <Input {...register('nom_structure', { required: true })} placeholder="Nom de la structure" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nom du porteur <span className="text-destructive">*</span></Label>
                  <Input {...register('porteur_nom', { required: true })} placeholder="Nom" />
                </div>
                <div className="space-y-1.5">
                  <Label>Sexe du porteur <span className="text-destructive">*</span></Label>
                  <Controller
                    name="porteur_sexe"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          {SEXE_VALUES.map((s) => (
                            <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Consentement RGPD ────────────────────────────────── */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                {...register('consentement', { required: true })}
                className="mt-1 size-4 rounded border-amber-300"
              />
              <span className="text-slate-700">
                J&apos;accepte que mes données soient traitées par l&apos;OIF dans le cadre
                du suivi-évaluation des projets Emploi Jeunes, conformément au RGPD.
                <span className="text-destructive"> *</span>
              </span>
            </label>
          </CardContent>
        </Card>

        {/* ── Erreur ───────────────────────────────────────────── */}
        {erreur && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="submit" disabled={isPending || !consentement} className="gap-2">
            <Send className="size-4" />
            {isPending ? 'Envoi en cours...' : 'Soumettre'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !consentement}
            onClick={handleSubmit(soumettreEtNouveau)}
            className="gap-2"
          >
            <Send className="size-4" />
            Soumettre et saisir un autre
          </Button>
        </div>

        {confirmationNouveau && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700">
            Soumission enregistrée. Vous pouvez en saisir une nouvelle.
          </p>
        )}
      </form>
    );
  }

  return null;
}
