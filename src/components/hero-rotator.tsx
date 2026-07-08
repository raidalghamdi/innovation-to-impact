'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

// Cycles the hero slogan through the program's three stages
// (Innovate → Compete → Impact) with a fade/slide transition.
export function HeroRotator({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 2000);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <span className="inline-flex flex-col items-center gap-4">
      <span className="relative inline-grid" aria-live="polite">
        {/* Reserve width for the widest word so layout doesn't jump. */}
        <span className="invisible col-start-1 row-start-1" aria-hidden="true">
          {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
        </span>
        {words.map((w, i) => (
          <span
            key={w}
            aria-hidden={i !== index}
            className={`col-start-1 row-start-1 bg-gradient-to-l from-brand-cyan-light via-brand-cyan to-brand-gold bg-clip-text text-transparent transition-all duration-500 ease-out ${
              i === index
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-2 opacity-0'
            }`}
          >
            {w}
          </span>
        ))}
      </span>

      {/* Three-stage progress indicator: ● → ● → ● with the active stage
          filled. `rtl:rotate-180` flips the arrows so they point with the
          reading direction in Arabic. */}
      {words.length > 1 && (
        <span className="flex items-center gap-2" aria-hidden="true">
          {words.map((w, i) => (
            <span key={`dot-${w}`} className="flex items-center gap-2">
              {i > 0 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-white/40 rtl:rotate-180" />
              )}
              <span
                className={`block rounded-full transition-all duration-500 ${
                  i === index
                    ? 'h-2.5 w-2.5 bg-brand-gold'
                    : 'h-2 w-2 bg-white/30'
                }`}
              />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
