"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

const PARTICLES = [
  { x: 62, y: 44, s: 1.2, d: 0 },
  { x: 55, y: 48, s: 0.9, d: 1.2 },
  { x: 66, y: 41, s: 1.0, d: 2.4 },
  { x: 58, y: 38, s: 0.7, d: 3.0 },
  { x: 68, y: 50, s: 0.8, d: 1.8 },
  { x: 60, y: 52, s: 1.1, d: 0.8 },
  { x: 53, y: 43, s: 0.6, d: 2.0 },
  { x: 64, y: 47, s: 0.8, d: 3.6 },
  { x: 57, y: 46, s: 0.7, d: 2.8 },
];

export default function LoginHeroVisual({ className = "" }: { className?: string }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className={`relative isolate aspect-[16/10] w-full select-none overflow-hidden rounded-2xl ${className}`}>
      {/* Resting paper */}
      <Image
        src="/hero/login_2.jpg"
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
      />

      {/* Active/peak paper — slow crossfade */}
      <Image
        src="/hero/login_1.jpg"
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        style={{
          opacity: reduce ? 0 : undefined,
          animation: reduce ? "none" : "hero-breathe 10s ease-in-out infinite",
        }}
      />

      {/* Golden particles */}
      {!reduce && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="rgb(var(--state-warning))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="rgb(var(--state-warning))" stopOpacity="0" />
            </radialGradient>
          </defs>
          {PARTICLES.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.s * 0.5}
              fill="url(#glow)"
              style={{
                opacity: 0,
                animation: `hero-glint 10s ease-in-out infinite`,
                animationDelay: `${p.d}s`,
              }}
            />
          ))}
        </svg>
      )}

      {/* Soft vignette so it dissolves into the page */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgb(var(--background) / 0.85) 100%)",
        }}
      />

      <style>{`
        @keyframes hero-breathe {
          0%, 100% { opacity: 0; }
          45% { opacity: 1; }
          55% { opacity: 1; }
        }
        @keyframes hero-glint {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 0; }
          50% { opacity: 0.7; transform: scale(1); }
          60% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
