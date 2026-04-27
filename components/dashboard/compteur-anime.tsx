'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Compteur animé qui interpole de 0 → `valeur` cible avec ease-out.
 *
 * V1.7.1 — Fix critique : la version v1.7.0 utilisait `useState` pour le
 * flag `aDemarre`, ce qui faisait re-rendre le composant et déclenchait le
 * cleanup de l'effet (qui clearTimeout-ait le démarrage avant qu'il ne
 * s'exécute). Résultat : la valeur restait figée à 0. Désormais le flag
 * est un `useRef` (mutation sans re-render).
 *
 * - Respecte `prefers-reduced-motion` (affiche directement la valeur cible).
 * - Fallback SSR : la valeur cible s'affiche immédiatement avant l'hydratation
 *   (pas de saut visible si JS désactivé / lent).
 * - Format `Intl.NumberFormat('fr-FR')` (espaces fines pour les milliers).
 * - Si la valeur cible change après mount (changement de période côté
 *   dashboard), le compteur saute directement à la nouvelle valeur sans
 *   re-rejouer l'animation (UX prévisible).
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
  // Initial state = valeur cible : SSR + premier paint affichent le bon
  // chiffre, l'animation rejoue à 0 → cible uniquement côté client.
  const [valeurCourante, setValeurCourante] = useState<number>(valeur);
  const ref = useRef<HTMLSpanElement>(null);
  const aDemarreRef = useRef(false);
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valeurCibleRef = useRef(valeur);

  // Si la valeur cible change après mount (ex. changement de période sur
  // le dashboard), on saute directement à la nouvelle cible plutôt que
  // de rejouer l'animation : ça évite un re-comptage perturbant l'UX.
  useEffect(() => {
    if (aDemarreRef.current && valeur !== valeurCibleRef.current) {
      valeurCibleRef.current = valeur;
      setValeurCourante(valeur);
    }
  }, [valeur]);

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
      aDemarreRef.current = true;
      return;
    }

    // Si la valeur cible est nulle ou négative, rien à animer.
    if (valeur <= 0) {
      setValeurCourante(valeur);
      aDemarreRef.current = true;
      return;
    }

    const demarrerAnimation = () => {
      if (aDemarreRef.current) return;
      aDemarreRef.current = true;
      valeurCibleRef.current = valeur;
      setValeurCourante(0);

      timeoutIdRef.current = setTimeout(() => {
        const debut = performance.now();
        const animer = (maintenant: number) => {
          const progres = Math.min(1, (maintenant - debut) / dureeMs);
          // ease-out cubic pour un atterrissage doux sur la cible
          const eased = 1 - Math.pow(1 - progres, 3);
          setValeurCourante(Math.round(valeurCibleRef.current * eased));
          if (progres < 1) {
            animationIdRef.current = requestAnimationFrame(animer);
          }
        };
        animationIdRef.current = requestAnimationFrame(animer);
      }, delaiMs);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            demarrerAnimation();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(noeud);

    return () => {
      observer.disconnect();
      if (animationIdRef.current !== null) cancelAnimationFrame(animationIdRef.current);
      if (timeoutIdRef.current !== null) clearTimeout(timeoutIdRef.current);
    };
    // Volontairement sans `valeur` en dep : la mise à jour de cible est
    // gérée par l'effet ci-dessus, et inclure `valeur` ici relancerait
    // tout le pipeline observer + timeout à chaque render, ce qui peut
    // tuer une animation en cours (cf. bug v1.7.0).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dureeMs, delaiMs]);

  return <span ref={ref}>{valeurCourante.toLocaleString('fr-FR')}</span>;
}
