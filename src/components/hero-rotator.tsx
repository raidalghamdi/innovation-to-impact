'use client';

import { useEffect, useState } from 'react';

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
  );
}
