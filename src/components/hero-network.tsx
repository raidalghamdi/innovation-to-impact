'use client';

/**
 * HeroNetwork — animated node-and-edge network canvas.
 *
 * Concept "ب" (shabakat al-munafasa / Competition Network) from the July 2026
 * Hero redesign brief. Slow-drifting teal nodes with sparse gold accents,
 * connected by thin lines that fade as distance grows. It's decorative but
 * cheap: single canvas, ~40 nodes, rAF-driven at ~60fps on any laptop.
 *
 * Accessibility:
 *   - `aria-hidden` — pure decoration.
 *   - Respects `prefers-reduced-motion` — freezes on a single frame when set,
 *     so the metaphor still lands without motion.
 *
 * Design notes:
 *   - Colors pulled from Tailwind CSS custom properties on <body> so the
 *     canvas stays inside the design system (--brand-teal, --brand-gold).
 *     We fall back to hex constants if the vars aren't resolvable (SSR guard).
 *   - Rendered at devicePixelRatio for crisp lines on Retina, but capped at 2×
 *     to keep the fill-rate low on 3× phones.
 */

import { useEffect, useRef } from 'react';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  gold: boolean;
};

const NODE_COUNT_DESKTOP = 46;
const NODE_COUNT_MOBILE = 28;
const CONNECT_DIST = 140; // px in CSS coords
const GOLD_RATIO = 0.14;

export function HeroNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const parent = canvas.parentElement;
    if (!parent) return;

    // Read design tokens; fallback to Nexus-brand hexes if vars unresolvable.
    const styles = getComputedStyle(document.documentElement);
    const teal = (styles.getPropertyValue('--brand-cyan-light').trim() || '#7CE0DA') as string;
    const gold = (styles.getPropertyValue('--brand-gold').trim() || '#F5B843') as string;

    let width = parent.clientWidth;
    let height = parent.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const setSize = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    const isMobile = width < 640;
    const count = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    const nodes: Node[] = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 1.6 + Math.random() * 1.8,
      gold: Math.random() < GOLD_RATIO,
    }));

    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Edges — draw first so nodes sit on top.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > CONNECT_DIST) continue;
          const alpha = 1 - d / CONNECT_DIST;
          // teal edge, faded, thin — use rgba manually so we can vary alpha
          ctx.strokeStyle = hexToRgba(teal, alpha * 0.35);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const n of nodes) {
        ctx.fillStyle = n.gold ? gold : teal;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        // Soft glow ring on gold accents — reinforces the "spark" idea.
        if (n.gold) {
          ctx.strokeStyle = hexToRgba(gold, 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    const tick = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    if (prefersReduced) {
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onResize = () => {
      setSize();
      // Nudge nodes back inside the new bounds.
      for (const n of nodes) {
        n.x = Math.min(Math.max(n.x, 0), width);
        n.y = Math.min(Math.max(n.y, 0), height);
      }
      draw();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    />
  );
}

// Convert #RRGGBB (or rgb() as raw text from CSS vars) to rgba(..., alpha).
// Safe for arbitrary spaces around the value — CSS vars often come padded.
function hexToRgba(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split('').map((h) => h + h).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (c.startsWith('rgb')) {
    // rgb(r g b) or rgb(r,g,b) — coerce to rgba
    return c.replace(/^rgb\s*\(?/, 'rgba(').replace(/\)$/, `, ${alpha})`);
  }
  return c;
}
