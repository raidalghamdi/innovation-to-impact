export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      aria-label="Innovation to Impact"
      role="img"
    >
      {/* Eight-segment ring representing the 8 stages converging to a core */}
      <circle cx="20" cy="20" r="6" fill="currentColor" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = 20 + Math.cos(angle) * 15;
        const y = 20 + Math.sin(angle) * 15;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === 7 ? 2.6 : 1.8}
            fill="currentColor"
            opacity={0.35 + (i / 8) * 0.65}
          />
        );
      })}
    </svg>
  );
}
