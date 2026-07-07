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
    // Prevent motion accumulator drift when the tab was backgrounded
    // (rAF fires with wildly large gaps on resume). Bug seen previously:
    // over time nodes appeared to “clump toward the middle”. Fixed by
    // (a) using a fixed logical step, (b) a small mutual repulsion when
    // two nodes get too close so they can't stagnate on top of each other,
    // (c) periodic small random impulse so stuck nodes get nudged.
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
    // Ensure every node has a non-trivial velocity in a random direction, so
    // over time they actually roam the canvas instead of drifting toward
    // whatever central hot-spot the reflections happen to favor.
    const MIN_SPEED = 0.15;
    const MAX_SPEED = 0.4;
    const randomVelocity = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    };
    const nodes: Node[] = Array.from({ length: count }, () => {
      const { vx, vy } = randomVelocity();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx,
        vy,
        r: 1.6 + Math.random() * 1.8,
        gold: Math.random() < GOLD_RATIO,
      };
    });

    const MIN_SEPARATION = 24; // px; below this, apply mild repulsion
    let frame = 0;

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
      frame++;
      // Mutual repulsion — keeps nodes from stagnating on top of each other
      // near the middle of the canvas. Applied at half the connectivity cost.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > MIN_SEPARATION * MIN_SEPARATION) continue;
          const d = Math.max(Math.sqrt(d2), 0.5);
          const push = (MIN_SEPARATION - d) / MIN_SEPARATION;
          const ux = dx / d;
          const uy = dy / d;
          const impulse = 0.02 * push;
          nodes[i].vx -= ux * impulse;
          nodes[i].vy -= uy * impulse;
          nodes[j].vx += ux * impulse;
          nodes[j].vy += uy * impulse;
        }
      }

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;

        // Bounce off walls; also nudge back inside if a resize pushed us out.
        if (n.x < 0) {
          n.x = 0;
          n.vx = Math.abs(n.vx);
        } else if (n.x > width) {
          n.x = width;
          n.vx = -Math.abs(n.vx);
        }
        if (n.y < 0) {
          n.y = 0;
          n.vy = Math.abs(n.vy);
        } else if (n.y > height) {
          n.y = height;
          n.vy = -Math.abs(n.vy);
        }

        // Clamp speed so repulsion impulses can't runaway.
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > MAX_SPEED) {
          n.vx = (n.vx / speed) * MAX_SPEED;
          n.vy = (n.vy / speed) * MAX_SPEED;
        } else if (speed < MIN_SPEED / 2) {
          // Speed collapsed — give it a fresh random direction.
          const v = randomVelocity();
          n.vx = v.vx;
          n.vy = v.vy;
        }
      }

      // Every ~4 seconds, add a tiny jitter to every node so long-lived
      // sessions never settle into a static pattern (this is the main
      // safeguard against the “clumps at center” regression).
      if (frame % 240 === 0) {
        for (const n of nodes) {
          n.vx += (Math.random() - 0.5) * 0.05;
          n.vy += (Math.random() - 0.5) * 0.05;
        }
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
