'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Carrousel hero plein-écran pour la vitrine publique (V1.5.0).
 *
 * - Rotation auto toutes les 5 secondes (pause au survol).
 * - Transition fade smooth entre slides (CSS opacity + position absolute).
 * - Overlay sombre pour lisibilité du contenu superposé (children).
 * - Navigation manuelle : flèches + dots.
 * - Préchargement de l'image courante via priority + sizes.
 * - Respecte prefers-reduced-motion (pause auto si l'utilisateur l'active).
 */

export type CarrouselSlide = {
  src: string;
  alt: string;
  /** Crédit photo affiché en bas à droite (ex. "© OIF — DCLIC PRO Jour 1"). */
  credit?: string;
};

export type CarrouselHeroProps = {
  slides: CarrouselSlide[];
  intervalleMs?: number;
  /** Hauteur du carrousel — h-[60vh] par défaut, h-[70vh] possible. */
  hauteurClass?: string;
  /** Contenu superposé (titre, sous-titre, CTA…). */
  children?: React.ReactNode;
};

export function CarrouselHero({
  slides,
  intervalleMs = 5000,
  hauteurClass = 'h-[60vh] min-h-[480px]',
  children,
}: CarrouselHeroProps) {
  const [index, setIndex] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
  }, []);

  useEffect(() => {
    if (enPause || reducedMotionRef.current || slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), intervalleMs);
    return () => clearInterval(t);
  }, [enPause, intervalleMs, slides.length]);

  if (slides.length === 0) return null;

  const aller = (n: number) => setIndex(((n % slides.length) + slides.length) % slides.length);

  return (
    <section
      className={cn('relative w-full overflow-hidden bg-gray-900', hauteurClass)}
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      aria-roledescription="carrousel"
      aria-label="Photographies des projets OIF Emploi Jeunes"
    >
      {slides.map((slide, i) => (
        <div
          key={slide.src}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000 ease-in-out',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="100vw"
            priority={i === 0}
            className="object-cover"
          />
          {/* Overlay sombre pour lisibilité du contenu */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E4F88]/70 via-[#0E4F88]/50 to-[#0E4F88]/80" />
          {slide.credit && (
            <p className="absolute right-4 bottom-4 text-xs text-white/70">{slide.credit}</p>
          )}
        </div>
      ))}

      {/* Contenu superposé */}
      {children && (
        <div className="relative z-10 flex h-full items-center justify-center px-4">{children}</div>
      )}

      {/* Navigation manuelle (flèches) — visibles seulement si plus d'une slide */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => aller(index - 1)}
            className="absolute top-1/2 left-4 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
            aria-label="Image précédente"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => aller(index + 1)}
            className="absolute top-1/2 right-4 z-20 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
            aria-label="Image suivante"
          >
            <ChevronRight aria-hidden className="size-6" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => aller(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/75',
                )}
                aria-label={`Aller à l'image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
