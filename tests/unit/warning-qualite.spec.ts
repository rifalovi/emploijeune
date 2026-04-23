import { describe, it, expect } from 'vitest';
import { messageWarningQualiteStatut } from '@/components/beneficiaires/warning-qualite';

/**
 * Règle Q2 Étape 4c : warning non bloquant pour l'utilisateur quand il
 * choisit « FORMATION_ACHEVEE » ou « ABANDON » sans avoir saisi la date
 * de fin de formation.
 *
 * Logique identique à la colonne générée `qualite_a_verifier` en BDD
 * (migration 007) — ce test documente le contrat UI ↔ DB.
 */

describe('messageWarningQualiteStatut', () => {
  it('retourne null si le statut est INSCRIT (pas de fin attendue)', () => {
    expect(messageWarningQualiteStatut('INSCRIT', null)).toBeNull();
    expect(messageWarningQualiteStatut('INSCRIT', '2024-06-01')).toBeNull();
  });

  it('retourne null si le statut est PRESENT_EFFECTIF', () => {
    expect(messageWarningQualiteStatut('PRESENT_EFFECTIF', null)).toBeNull();
  });

  it('retourne un message si FORMATION_ACHEVEE sans date de fin', () => {
    const msg = messageWarningQualiteStatut('FORMATION_ACHEVEE', null);
    expect(msg).toBeTruthy();
    expect(msg).toContain('Formation achevée');
    expect(msg).toContain('date de fin');
  });

  it('retourne un message si FORMATION_ACHEVEE avec date vide (string)', () => {
    expect(messageWarningQualiteStatut('FORMATION_ACHEVEE', '')).toBeTruthy();
    expect(messageWarningQualiteStatut('FORMATION_ACHEVEE', '   ')).toBeTruthy();
  });

  it('retourne null si FORMATION_ACHEVEE avec date de fin renseignée', () => {
    expect(messageWarningQualiteStatut('FORMATION_ACHEVEE', '2024-06-30')).toBeNull();
    expect(messageWarningQualiteStatut('FORMATION_ACHEVEE', new Date())).toBeNull();
  });

  it('retourne un message si ABANDON sans date de fin', () => {
    const msg = messageWarningQualiteStatut('ABANDON', null);
    expect(msg).toBeTruthy();
  });

  it('retourne null si ABANDON avec date de fin', () => {
    expect(messageWarningQualiteStatut('ABANDON', '2024-03-15')).toBeNull();
  });

  it('retourne null si statut undefined', () => {
    expect(messageWarningQualiteStatut(undefined, null)).toBeNull();
  });

  it('retourne null pour un statut non listé (NON_PRECISE)', () => {
    expect(messageWarningQualiteStatut('NON_PRECISE', null)).toBeNull();
  });
});
