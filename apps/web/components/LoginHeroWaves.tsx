"use client";

import { useEffect, useMemo, useState } from "react";

const WIDTH = 600;
const HEIGHT = 360;
const LINE_COUNT = 4;

export default function LoginHeroWaves({ className = "" }: { className?: string }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const lines = useMemo(() => generateLines(2026), []);
  const peaks = useMemo(() => findPeaks(lines), [lines]);

  return (
    <div className={`relative isolate aspect-[16/10] w-full overflow-hidden rounded-2xl ${className}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="waveGlow">
            <stop offset="0%" stopColor="rgb(var(--state-warning))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="rgb(var(--state-warning))" stopOpacity="0" />
          </radialGradient>
          <mask id="waveVignette">
            <rect width={WIDTH} height={HEIGHT} fill="white" />
            <radialGradient id="vignetteFade">
              <stop offset="40%" stopColor="black" />
              <stop offset="100%" stopColor="white" />
            </radialGradient>
            <rect width={WIDTH} height={HEIGHT} fill="url(#vignetteFade)" />
          </mask>
        </defs>

        <g mask="url(#waveVignette)">
          {lines.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              style={{
                opacity: reduce ? 0.22 : undefined,
                strokeDasharray: 1,
                strokeDashoffset: reduce ? 0 : 1,
                animation: reduce ? "none" : `waveDraw 6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 1.1}s forwards, waveHold 8s ease-in-out ${6 + i * 1.1}s infinite alternate`,
              }}
            />
          ))}

          {/* Golden traveling pulse along each wave */}
          {!reduce && lines.map((d, i) => (
            <path
              key={`travel-${i}`}
              d={d}
              fill="none"
              stroke="url(#waveGlow)"
              strokeWidth={2.6}
              strokeLinecap="round"
              pathLength="1"
              style={{
                opacity: 0.55,
                strokeDasharray: "0.08 0.92",
                strokeDashoffset: 0,
                animation: `waveTravel 9s linear ${i * 1.4}s infinite`,
              }}
            />
          ))}

          {peaks.map((p, i) => (
            <circle
              key={`p-${i}`}
              cx={p.x}
              cy={p.y}
              r={2.2}
              fill="url(#waveGlow)"
              style={{
                opacity: 0,
                transformOrigin: "center",
                transformBox: "fill-box",
                animation: reduce ? "none" : `waveGlint 5s ease-in-out ${6.5 + (i % 4) * 0.9}s infinite`,
              }}
            />
          ))}

          {/* Slow vertical scan line */}
          {!reduce && (
            <g style={{ animation: "scanMove 14s cubic-bezier(0.45, 0, 0.55, 1) infinite" }}>
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={HEIGHT}
                stroke="currentColor"
                strokeWidth={0.7}
                style={{ opacity: 0.14 }}
              />
            </g>
          )}
        </g>

        <style>{`
          @keyframes waveDraw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes waveHold {
            from { opacity: 0.18; }
            to { opacity: 0.32; }
          }
          @keyframes waveGlint {
            0%, 100% { opacity: 0; transform: scale(0.6); }
            45% { opacity: 0.75; transform: scale(1); }
            55% { opacity: 0.75; transform: scale(1); }
            80% { opacity: 0; transform: scale(0.6); }
          }
          @keyframes waveTravel {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -1; }
          }
          @keyframes scanMove {
            from { transform: translateX(-2px); }
            to { transform: translateX(${WIDTH + 2}px); }
          }
        `}</style>
      </svg>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgb(var(--background) / 0.85) 100%)",
        }}
      />
    </div>
  );
}

function generateLines(seed: number): string[] {
  const rng = seededRandom(seed);
  const lines: string[] = [];

  for (let l = 0; l < LINE_COUNT; l++) {
    const yBase = 100 + l * 55 + rng() * 20;
    const amplitude = 25 + rng() * 35;
    const frequency = 2 + Math.floor(rng() * 3);
    const phase = rng() * Math.PI * 2;

    const points: { x: number; y: number }[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * WIDTH;
      const wave = Math.sin((i / steps) * Math.PI * frequency + phase) * amplitude;
      const envelope = Math.sin((i / steps) * Math.PI); // taper at edges
      const y = yBase - wave * envelope;
      points.push({ x, y });
    }

    // Build smooth cubic bezier path through points
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) * 0.5;
      const cp2y = curr.y;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }
    lines.push(d);
  }

  return lines;
}

function findPeaks(lines: string[]): { x: number; y: number }[] {
  const peaks: { x: number; y: number }[] = [];
  lines.forEach((d) => {
    const matches = d.match(/(\d+\.?\d*)\s+(\d+\.?\d*)/g);
    if (!matches) return;
    const points = matches.map((m) => {
      const [x, y] = m.split(/\s+/).map(Number);
      return { x, y };
    });

    for (let i = 2; i < points.length - 2; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      if (curr.y < prev.y && curr.y < next.y && Math.random() < 0.35) {
        peaks.push({ x: curr.x, y: curr.y });
      }
    }
  });
  return peaks.slice(0, 14);
}

function seededRandom(seed: number): () => number {
  let current = Math.abs(seed) || 1;
  return () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };
}
