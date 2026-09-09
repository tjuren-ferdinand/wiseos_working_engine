"use client";

import { useEffect, useState } from "react";

const PAPER = { x: 110, y: 44, w: 380, h: 272 };

const ANSWERS = [
  { y: 104, math: "f(x) = x² + 5x − 3", delay: 1.8 },
  { y: 148, math: "x = (−5 ± √37) / 2", delay: 3.0 },
  { y: 192, math: "∫ 2x dx = x² + C", delay: 4.2 },
  { y: 236, math: "lim  sin x / x = 1", delay: 5.4 },
];

export default function LoginHeroAIGrading({ className = "" }: { className?: string }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      className={`relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 600 360"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="scanBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(var(--accent))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
          <filter id="paperDepth" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="20" floodColor="rgb(var(--foreground) / 0.14)" />
          </filter>
          <filter id="aiGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Paper */}
        <g filter="url(#paperDepth)">
          <rect
            x={PAPER.x}
            y={PAPER.y}
            width={PAPER.w}
            height={PAPER.h}
            rx="14"
            fill="rgb(var(--surface-elevated))"
          />
        </g>

        {/* Header */}
        <text
          x={PAPER.x + 28}
          y={PAPER.y + 32}
          fill="rgb(var(--foreground))"
          fontSize="11"
          fontWeight="600"
          fontFamily="Inter, sans-serif"
          style={{ opacity: 0.55, letterSpacing: "0.04em" }}
        >
          MATEMATIK 5 — PROV
        </text>
        <line
          x1={PAPER.x + 28}
          y1={PAPER.y + 44}
          x2={PAPER.x + PAPER.w - 28}
          y2={PAPER.y + 44}
          stroke="rgb(var(--foreground))"
          strokeWidth="0.5"
          style={{ opacity: 0.12 }}
        />

        {/* Answers with handwritten math + checkmarks */}
        {ANSWERS.map((a, i) => (
          <g key={i}>
            {/* Answer number */}
            <text
              x={PAPER.x + 28}
              y={a.y - 2}
              fill="rgb(var(--muted))"
              fontSize="9"
              fontWeight="500"
              fontFamily="Inter, sans-serif"
              style={{ opacity: 0.4 }}
            >
              {`${i + 1}.`}
            </text>
            {/* Handwritten math */}
            <text
              x={PAPER.x + 48}
              y={a.y}
              fill="rgb(var(--foreground))"
              fontSize="17"
              fontFamily="Caveat, cursive"
              style={{
                opacity: reduce ? 0.7 : undefined,
                animation: reduce ? "none" : `handAppear 0.5s ease-out ${a.delay}s both`,
              }}
            >
              {a.math}
            </text>
            {/* Checkmark */}
            <g
              transform={`translate(${PAPER.x + PAPER.w - 38}, ${a.y - 4})`}
              style={{
                opacity: reduce ? 1 : undefined,
              }}
            >
              <circle
                r="9"
                fill="rgb(var(--state-success) / 0.12)"
                style={{
                  opacity: reduce ? 1 : 0,
                  transformOrigin: "center",
                  transformBox: "fill-box",
                  animation: reduce ? "none" : `checkPop 0.4s ease-out ${a.delay + 0.3}s both`,
                }}
              />
              <path
                d="M-5 0 L-1 4 L6 -5"
                fill="none"
                stroke="rgb(var(--state-success))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: reduce ? 0 : 1,
                  animation: reduce ? "none" : `checkDraw 0.4s ease-out ${a.delay + 0.35}s forwards`,
                }}
              />
            </g>
          </g>
        ))}

        {/* Scanning beam */}
        {!reduce && (
          <>
            <rect
              x={PAPER.x - 4}
              y={PAPER.y}
              width={PAPER.w + 8}
              height="36"
              fill="url(#scanBeam)"
              style={{
                animation: `beamMove 7s cubic-bezier(0.35, 0, 0.25, 1) infinite`,
              }}
            />
            <line
              x1={PAPER.x}
              y1={PAPER.y}
              x2={PAPER.x + PAPER.w}
              y2={PAPER.y}
              stroke="rgb(var(--accent))"
              strokeWidth="1"
              style={{
                opacity: 0.8,
                animation: `beamMove 7s cubic-bezier(0.35, 0, 0.25, 1) infinite`,
              }}
            />
            {/* AI badge */}
            <g
              transform={`translate(${PAPER.x + PAPER.w - 52}, ${PAPER.y + 14})`}
              style={{
                opacity: 0,
                animation: `aiBadge 7s ease-in-out infinite`,
              }}
            >
              <rect x="-22" y="-10" width="44" height="20" rx="10" fill="rgb(var(--accent) / 0.14)" />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="rgb(var(--accent))"
                fontSize="9"
                fontWeight="600"
                fontFamily="Inter, sans-serif"
                style={{ letterSpacing: "0.08em" }}
              >
                AI
              </text>
            </g>
          </>
        )}

        <style>{`
          @keyframes beamMove {
            0% { transform: translateY(0); opacity: 0; }
            6% { opacity: 1; }
            94% { opacity: 1; }
            100% { transform: translateY(${PAPER.h}px); opacity: 0; }
          }
          @keyframes handAppear {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 0.72; transform: translateY(0); }
          }
          @keyframes checkPop {
            from { opacity: 0; transform: scale(0.3); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes checkDraw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes aiBadge {
            0%, 5% { opacity: 0; }
            10%, 85% { opacity: 1; }
            90%, 100% { opacity: 0; }
          }
        `}</style>
      </svg>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgb(var(--background) / 0.8) 100%)",
        }}
      />
    </div>
  );
}
