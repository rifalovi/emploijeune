'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Persistance d'un brouillon de questionnaire dans le localStorage navigateur.
 *
 * Décision Étape 6d : pas de table BDD dédiée aux brouillons en V1 (cf.
 * cadrage § 3.4) — coût (table + sync + nettoyage) > bénéfice pour 60
 * partenaires sur formulaire de 5-15 minutes. Le brouillon est local au
 * poste / navigateur ; la soumission complète est envoyée en une fois
 * via Server Action (6e).
 *
 * Clé : `enquete:draft:{questionnaire}:{cibleId}` — unique par couple
 * (questionnaire, cible) pour éviter les collisions entre 2 saisies en
 * cours sur le même bénéficiaire (cas marginal mais possible).
 *
 * Comportement :
 *   - Lecture : à l'init, restaure le brouillon s'il existe ET n'est pas
 *     plus vieux que `MAX_AGE_MS` (24 h par défaut).
 *   - Écriture : debounce 500 ms après chaque mutation pour éviter de
 *     spammer le storage à chaque keystroke.
 *   - Effacement : appel explicite après soumission réussie.
 */

const STORAGE_PREFIX = 'enquete:draft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

type StoredDraft<T> = {
  payload: T;
  savedAt: number;
};

export function useBrouillonEnquete<T extends Record<string, unknown>>(
  questionnaire: 'A' | 'B',
  cibleId: string,
  initial: T,
): {
  payload: T;
  setPayload: React.Dispatch<React.SetStateAction<T>>;
  effacer: () => void;
  derniereSauvegarde: Date | null;
} {
  const storageKey = `${STORAGE_PREFIX}${questionnaire}:${cibleId}`;

  const [payload, setPayload] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
        window.localStorage.removeItem(storageKey);
        return initial;
      }
      return { ...initial, ...parsed.payload };
    } catch {
      return initial;
    }
  });

  const [derniereSauvegarde, setDerniereSauvegarde] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce 500 ms : sauvegarde après pause de saisie utilisateur.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const stored: StoredDraft<T> = { payload, savedAt: Date.now() };
        window.localStorage.setItem(storageKey, JSON.stringify(stored));
        setDerniereSauvegarde(new Date());
      } catch {
        // Storage saturé / privé → on ignore silencieusement
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload, storageKey]);

  const effacer = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(storageKey);
      setDerniereSauvegarde(null);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { payload, setPayload, effacer, derniereSauvegarde };
}
