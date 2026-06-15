'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Compteur animé qui interpole de 0 → `valeur` cible avec ease-out.
 *
 * - Respecte `prefers-reduced-motion` (affiche directement la valeur cible).
 * - Fallback SSR : la valeur cible s'affiche immédiatement avant l'hydratation.
 * - Format `Intl.NumberFormat('fr-FR')` (espaces fines pour les milliers).
 * - `decimales` : nombre de décimales à conserver (ex. 2 pour un taux 78,55).
 *   Par défaut 0 (effectifs entiers).
 */
export function CompteurAnime({
  valeur,
  dureeMs = 1500,
  delaiMs = 0,
  decimales = 0,
}: {
  valeur: number;
  /** Durée totale d'interpolation en ms. Défaut 1500. */
  dureeMs?: number;
  /** Délai avant démarrage (synchronisé avec stagger CSS). Défaut 0. */
  delaiMs?: number;
  /** Décimales conservées à l'affichage (taux = 2, effectifs = 0). */
  decimales?: number;
}) {
  const facteur = 10 ** decimales;
  const arrondir = (v: number) => Math.round(v * facteur) / facteur;

  const [valeurCourante, setValeurCourante] = useState<number>(arrondir(valeur));
  const ref = useRef<HTMLSpanElement>(null);
  const aDemarreRef = useRef(false);
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valeurCibleRef = useRef(valeur);

  useEffect(() => {
    if (aDemarreRef.current && valeur !== valeurCibleRef.current) {
      valeurCibleRef.current = valeur;
      setValeurCourante(arrondir(valeur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValeurCourante(arrondir(valeur));
      aDemarreRef.current = true;
      return;
    }

    if (valeur <= 0) {
      setValeurCourante(arrondir(valeur));
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
          const eased = 1 - Math.pow(1 - progres, 3);
          setValeurCourante(arrondir(valeurCibleRef.current * eased));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dureeMs, delaiMs]);

  return (
    <span ref={ref}>
      {valeurCourante.toLocaleString('fr-FR', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })}
    </span>
  );
}
