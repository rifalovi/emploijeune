'use client';

/**
 * Formulaire unifie (Type 0) — identite + questionnaire complet.
 *
 * Flux :
 *   1. Categorie (beneficiaire / structure)
 *   2. Q101 RGPD en tete — si Non : message "Fin" + soumission directe
 *      Si Oui : identite + questionnaire A ou B + bouton Soumettre
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { User, Building2, ChevronLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { InfoLienPublic } from '@/lib/collecte-publique/actions';
import type { TrancheAgeOption } from './collecte-form';
import { QUESTIONNAIRE_A, QUESTIONNAIRE_B } from '@/lib/schemas/enquetes/questionnaires';
import type { Question, Section } from '@/lib/schemas/enquetes/questionnaires';
import { PAYS_OIF } from '@/lib/schemas/nomenclatures';

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

const SEXE_VALUES = ['F', 'M'] as const;
const SEXE_LIBELLES: Record<string, string> = { F: 'Femme', M: 'Homme' };

// ── Helpers skip logic ───────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function estVisible(q: Question, values: Record<string, unknown>): boolean {
  if (!q.affiche_si) return true;
  const val = getNestedValue(values, q.affiche_si.champ_payload);
  return val === q.affiche_si.valeur_egale;
}

// ── Renderer de question ─────────────────────────────────────────────────────

function QuestionField({
  question: q,
  register,
  control,
  visible,
  errors,
}: {
  question: Question;
  register: ReturnType<typeof useForm>['register'];
  control: ReturnType<typeof useForm>['control'];
  visible: boolean;
  errors: Record<string, unknown>;
}) {
  if (!visible) return null;

  const path = q.champ_payload;
  // Acces a l'erreur via chemin plat ou imbrique
  const fieldError = path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, errors) as { message?: string } | undefined;

  switch (q.type) {
    case 'oui_non':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle} {q.obligatoire && <span className="text-destructive">*</span>}</Label>
          {q.aide && <p className="text-xs text-slate-400">{q.aide}</p>}
          <Controller
            name={path}
            control={control}
            rules={q.obligatoire ? { validate: (v) => v === true || v === false || 'Requis' } : undefined}
            render={({ field }) => (
              <div className="flex gap-3">
                <button type="button" onClick={() => field.onChange(true)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${field.value === true ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                  Oui
                </button>
                <button type="button" onClick={() => field.onChange(false)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${field.value === false ? 'border-red-400 bg-red-50 font-semibold text-red-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                  Non
                </button>
              </div>
            )}
          />
          {fieldError?.message && (
            <p className="text-xs text-destructive">{fieldError.message}</p>
          )}
        </div>
      );

    case 'choix_unique':
    case 'echelle':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle} {q.obligatoire && <span className="text-destructive">*</span>}</Label>
          {q.aide && <p className="text-xs text-slate-400">{q.aide}</p>}
          <Controller
            name={path}
            control={control}
            rules={q.obligatoire ? { required: 'Requis' } : undefined}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {(q.options ?? []).map((o) => (
                    <SelectItem key={o.valeur} value={o.valeur}>{o.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {fieldError?.message && (
            <p className="text-xs text-destructive">{fieldError.message}</p>
          )}
        </div>
      );

    case 'texte_court':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle} {q.obligatoire && <span className="text-destructive">*</span>}</Label>
          <Input {...register(path, q.obligatoire ? { required: 'Requis' } : undefined)} placeholder="Votre reponse" />
          {fieldError?.message && (
            <p className="text-xs text-destructive">{fieldError.message}</p>
          )}
        </div>
      );

    case 'texte_long':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle}</Label>
          <Textarea {...register(path)} rows={3} placeholder="Votre reponse" />
        </div>
      );

    case 'nombre_entier':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle} {q.obligatoire && <span className="text-destructive">*</span>}</Label>
          <Input type="number" {...register(path, { valueAsNumber: true })} placeholder="0" />
        </div>
      );

    case 'nombre_decimal':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle}</Label>
          <Input type="number" step="0.01" {...register(path, { valueAsNumber: true })} placeholder="0.00" />
        </div>
      );

    case 'annee':
      return (
        <div className="space-y-1.5">
          <Label>{q.libelle}</Label>
          <Input type="number" min="2000" max="2100" {...register(path, { valueAsNumber: true })} placeholder={String(new Date().getFullYear())} />
        </div>
      );

    default:
      return null;
  }
}

// ── Renderer de section ──────────────────────────────────────────────────────

function SectionRenderer({
  section,
  register,
  control,
  values,
  errors,
}: {
  section: Section;
  register: ReturnType<typeof useForm>['register'];
  control: ReturnType<typeof useForm>['control'];
  values: Record<string, unknown>;
  errors: Record<string, unknown>;
}) {
  const questionsVisibles = section.questions.filter((q) => estVisible(q, values));
  if (questionsVisibles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-800">{section.titre}</CardTitle>
        {section.description && (
          <p className="text-xs text-slate-400">{section.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {section.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            register={register}
            control={control}
            visible={estVisible(q, values)}
            errors={errors}
          />
        ))}
      </CardContent>
    </Card>
  );
}

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

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm();

  const values = watch();
  const consentementRGPD = values.consentement_rgpd as boolean | undefined;
  const paysCode = values.pays_code as string | undefined;
  const porteurPaysCode = values.porteur_pays_code as string | undefined;

  const questionnaire = categorie === 'structure' ? QUESTIONNAIRE_B : QUESTIONNAIRE_A;
  const rgpdSection = questionnaire.sections[0] as Section;
  const autresSections = questionnaire.sections.slice(1);

  const construireDonnees = (data: Record<string, unknown>): Record<string, unknown> => ({
    ...data,
    meta: { categorie, source: 'formulaire_unifie_type_0' },
    projet_code: lien.projet_code,
  });

  const soumettre = (data: Record<string, unknown>) => onSubmit(construireDonnees(data));
  const soumettreEtNouveau = (data: Record<string, unknown>) => onSubmitEtNouveau(construireDonnees(data));

  // Soumission directe pour refus de consentement (pas de validation rhf)
  const soumettreRefus = () => {
    onSubmit(construireDonnees({ consentement_rgpd: false }));
  };

  // ── Etape 0 : Choix de categorie ──────────────────────────────────────

  if (etape === 0) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-slate-700">
          Quelle categorie vous correspond ?
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            {
              id: 'beneficiaire' as Categorie,
              icon: User,
              titre: 'Je suis une personne',
              desc: "Beneficiaire ayant recu une formation, un accompagnement ou un appui a l'insertion professionnelle via l'OIF.",
              couleur: '#5D0073',
            },
            {
              id: 'structure' as Categorie,
              icon: Building2,
              titre: 'Je represente une structure',
              desc: "Organisation, entreprise ou association ayant beneficie d'un appui (subvention, formation, accompagnement).",
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
              <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: opt.couleur }}>
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

  // ── Etape 1 : RGPD + formulaire complet ──────────────────────────────

  return (
    <form onSubmit={handleSubmit(soumettre)} className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <Button type="button" variant="outline" size="sm" onClick={() => { setEtape(0); reset(); }} className="flex items-center gap-1">
          <ChevronLeft className="size-4" /> Changer de catégorie
        </Button>
        <span>{questionnaire.titre}</span>
      </div>

      {/* ── Section RGPD (toujours affichee en premier) ──────────────── */}
      <SectionRenderer
        section={rgpdSection}
        register={register}
        control={control}
        values={values}
        errors={errors as Record<string, unknown>}
      />

      {/* ── Refus consentement → fin du questionnaire ────────────────── */}
      {consentementRGPD === false && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <p className="text-sm text-slate-600">
              Fin du questionnaire — merci de votre temps.
            </p>
            {erreur && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>
            )}
            <Button type="button" onClick={soumettreRefus} disabled={isPending} className="gap-2">
              <Send className="size-4" />
              {isPending ? 'Envoi en cours...' : 'Terminer'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Consentement donne → afficher le formulaire complet ──────── */}
      {consentementRGPD === true && (
        <>
          {/* ── Identification beneficiaire ─────────────────────────── */}
          {categorie === 'beneficiaire' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informations generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nom <span className="text-destructive">*</span></Label>
                    <Input {...register('nom', { required: 'Requis' })} placeholder="Nom de famille" />
                    {errors.nom && (
                      <p className="text-xs text-destructive">{errors.nom.message as string}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prenom <span className="text-destructive">*</span></Label>
                    <Input {...register('prenom', { required: 'Requis' })} placeholder="Prenom" />
                    {errors.prenom && (
                      <p className="text-xs text-destructive">{errors.prenom.message as string}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sexe <span className="text-destructive">*</span></Label>
                    <Controller name="sexe" control={control} rules={{ required: 'Requis' }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            {SEXE_VALUES.map((s) => <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.sexe && (
                      <p className="text-xs text-destructive">{errors.sexe.message as string}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tranche d&apos;age <span className="text-destructive">*</span></Label>
                    <Controller name="tranche_age_declaree" control={control} rules={{ required: 'Requis' }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            {tranchesAge.length > 0
                              ? tranchesAge.map((t) => (
                                  <SelectItem key={t.id} value={t.libelle}>{t.libelle} ({t.categorie_oif})</SelectItem>
                                ))
                              : (
                                <>
                                  <SelectItem value="15-34 ans">15-34 ans</SelectItem>
                                  <SelectItem value="35 ans et plus">35 ans et plus</SelectItem>
                                </>
                              )
                            }
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.tranche_age_declaree && (
                      <p className="text-xs text-destructive">{errors.tranche_age_declaree.message as string}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pays <span className="text-destructive">*</span></Label>
                  <Controller name="pays_code" control={control} rules={{ required: 'Requis' }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner un pays..." /></SelectTrigger>
                        <SelectContent>
                          {PAYS_OIF.map((p) => (
                            <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.pays_code && (
                    <p className="text-xs text-destructive">{errors.pays_code.message as string}</p>
                  )}
                </div>
                {paysCode === 'AUTRE' && (
                  <div className="space-y-1.5">
                    <Label>Préciser le pays <span className="text-destructive">*</span></Label>
                    <Input {...register('pays_autre', { required: 'Requis' })} placeholder="Nom du pays" />
                    {errors.pays_autre && (
                      <p className="text-xs text-destructive">{errors.pays_autre.message as string}</p>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" {...register('email')} placeholder="votre@email.com" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Identification structure ─────────────────────────────── */}
          {categorie === 'structure' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informations generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nom de la structure <span className="text-destructive">*</span></Label>
                  <Input {...register('nom_structure', { required: 'Requis' })} placeholder="Nom de la structure" />
                  {errors.nom_structure && (
                    <p className="text-xs text-destructive">{errors.nom_structure.message as string}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nom du porteur <span className="text-destructive">*</span></Label>
                    <Input {...register('porteur_nom', { required: 'Requis' })} placeholder="Nom complet" />
                    {errors.porteur_nom && (
                      <p className="text-xs text-destructive">{errors.porteur_nom.message as string}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sexe du porteur <span className="text-destructive">*</span></Label>
                    <Controller name="porteur_sexe" control={control} rules={{ required: 'Requis' }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            {SEXE_VALUES.map((s) => <SelectItem key={s} value={s}>{SEXE_LIBELLES[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.porteur_sexe && (
                      <p className="text-xs text-destructive">{errors.porteur_sexe.message as string}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pays de la structure <span className="text-destructive">*</span></Label>
                  <Controller name="porteur_pays_code" control={control} rules={{ required: 'Requis' }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value as string ?? ''}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner un pays..." /></SelectTrigger>
                        <SelectContent>
                          {PAYS_OIF.map((p) => (
                            <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.porteur_pays_code && (
                    <p className="text-xs text-destructive">{errors.porteur_pays_code.message as string}</p>
                  )}
                </div>
                {porteurPaysCode === 'AUTRE' && (
                  <div className="space-y-1.5">
                    <Label>Préciser le pays <span className="text-destructive">*</span></Label>
                    <Input {...register('porteur_pays_autre', { required: 'Requis' })} placeholder="Nom du pays" />
                    {errors.porteur_pays_autre && (
                      <p className="text-xs text-destructive">{errors.porteur_pays_autre.message as string}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Sections du questionnaire (sans la section RGPD) ────── */}
          {autresSections.map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              register={register}
              control={control}
              values={values}
              errors={errors as Record<string, unknown>}
            />
          ))}

          {erreur && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={isPending} className="gap-2">
              <Send className="size-4" />
              {isPending ? 'Envoi en cours...' : 'Soumettre'}
            </Button>
            <Button type="button" variant="outline" disabled={isPending}
              onClick={handleSubmit(soumettreEtNouveau)} className="gap-2">
              <Send className="size-4" />
              Soumettre et saisir un autre
            </Button>
          </div>

          {confirmationNouveau && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700">
              Soumission enregistree. Vous pouvez en saisir une nouvelle.
            </p>
          )}
        </>
      )}
    </form>
  );
}
