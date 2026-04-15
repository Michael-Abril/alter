'use client';

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: `${(i * 13.7 + 5) % 100}%`,
  delay: `${(i * 1.3) % 10}s`,
  duration: `${12 + (i % 6) * 2.5}s`,
  size: i % 3 === 0 ? 3.5 : i % 3 === 1 ? 2.5 : 2,
  opacity: i % 3 === 0 ? 0.7 : i % 3 === 1 ? 0.5 : 0.35,
}));

export function GoldParticles({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: `rgba(212, 167, 68, ${p.opacity})`,
            animation: `alter-particle-drift ${p.duration} ${p.delay} linear infinite`,
          }}
        />
      ))}
    </div>
  );
}
