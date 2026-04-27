'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Compteur animé qui interpole de 0 → `valeur` cible avec ease-out.
 *
 * V1.7.0 — refonte premium des cards KPI. Déclenché à l'entrée dans le
 * viewport via `IntersectionObserver` pour économiser le rAF quand la
 * carte n'est pas visible (pertinent sur dashboards longs).
 *
 * - Respecte `prefers-reduced-motion` (affiche directement la valeur cible).
 * - Fallback SSR : la valeur cible s'affiche immédiatement avant l'hydratation
 *   (pas de saut visible si JS désactivé / lent).
 * - Format `Intl.NumberFormat('fr-FR')` (espaces fines pour les milliers).
 */
export function CompteurAnime({
  valeur,
  dureeMs = 1500,
  delaiMs = 0,
}: {
  valeur: number;
  /** Durée totale d'interpolation en ms. Défaut 1500. */
  dureeMs?: number;
  /** Délai avant démarrage (synchronisé avec stagger CSS). Défaut 0. */
  delaiMs?: number;
}) {
  const [valeurCourante, setValeurCourante] = useState<number>(valeur);
  const [aDemarre, setADemarre] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    // Respect strict de prefers-reduced-motion : on garde la valeur cible
    // affichée par le SSR, aucune animation déclenchée.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValeurCourante(valeur);
      return;
    }

    // Si déjà animé une fois, on garde la valeur finale (pas de re-trigger
    // au scroll).
    if (aDemarre) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setADemarre(true);
            // On démarre à 0 puis on interpole — synchronisé avec le délai
            // CSS pour un stagger cohérent visuellement.
            setValeurCourante(0);
            timeoutIdRef.current = setTimeout(() => {
              const debut = performance.now();
              const animer = (maintenant: number) => {
                const progres = Math.min(1, (maintenant - debut) / dureeMs);
                // ease-out cubic pour un atterrissage doux sur la cible
                const eased = 1 - Math.pow(1 - progres, 3);
                setValeurCourante(Math.round(valeur * eased));
                if (progres < 1) {
                  animationIdRef.current = requestAnimationFrame(animer);
                }
              };
              animationIdRef.current = requestAnimationFrame(animer);
            }, delaiMs);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(noeud);

    return () => {
      observer.disconnect();
      if (animationIdRef.current !== null) cancelAnimationFrame(animationIdRef.current);
      if (timeoutIdRef.current !== null) clearTimeout(timeoutIdRef.current);
    };
  }, [valeur, dureeMs, delaiMs, aDemarre]);

  return <span ref={ref}>{valeurCourante.toLocaleString('fr-FR')}</span>;
}
