"use client";

import { useEffect, useState } from "react";

const LINES = 7;
const PAPER = { x: 120, y: 60, w: 360, h: 240 };

export default function LoginHeroScan({ className = "" }: { className?: string }) {
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
          <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--state-success))" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(var(--state-success))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(var(--state-success))" stopOpacity="0" />
          </linearGradient>
          <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="rgb(var(--foreground) / 0.12)" />
          </filter>
        </defs>

        {/* Paper */}
        <g filter="url(#paperShadow)">
          <rect
            x={PAPER.x}
            y={PAPER.y}
            width={PAPER.w}
            height={PAPER.h}
            rx="12"
            fill="rgb(var(--surface-elevated))"
          />
        </g>

        {/* Text lines */}
        {Array.from({ length: LINES }, (_, i) => (
          <g key={i}>
            <rect
              x={PAPER.x + 28}
              y={PAPER.y + 46 + i * 26}
              width={PAPER.w - 56}
              height="5"
              rx="2.5"
              fill="rgb(var(--muted-2))"
              style={{ opacity: 0.28 }}
            />
            <circle
              cx={PAPER.x + PAPER.w - 40}
              cy={PAPER.y + 48.5 + i * 26}
              r="3"
              fill="rgb(var(--state-success))"
              style={{
                opacity: 0,
                transformOrigin: "center",
                transformBox: "fill-box",
                animation: reduce
                  ? "none"
                  : `scanReveal 0.6s ease-out ${2.2 + i * 0.7}s forwards`,
              }}
            />
          </g>
        ))}

        {/* Scanning bar */}
        {!reduce && (
          <>
            <rect
              x={PAPER.x - 2}
              y={PAPER.y}
              width={PAPER.w + 4}
              height="4"
              rx="2"
              fill="url(#scanGlow)"
              style={{
                opacity: 0.9,
                animation: `scanMove 7s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              }}
            />
            <line
              x1={PAPER.x}
              y1={PAPER.y}
              x2={PAPER.x + PAPER.w}
              y2={PAPER.y}
              stroke="rgb(var(--state-success))"
              strokeWidth="0.8"
              style={{
                opacity: 0.7,
                animation: `scanMove 7s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              }}
            />
          </>
        )}

        {/* Final check */}
        <g
          transform={`translate(${PAPER.x + PAPER.w / 2 - 14}, ${PAPER.y + PAPER.h - 42})`}
          style={{
            opacity: 0,
            animation: reduce ? "none" : `scanCheck 0.6s ease-out 7.2s forwards`,
          }}
        >
          <circle r="14" fill="rgb(var(--state-success) / 0.12)" />
          <path
            d="M-7 0 L-2 6 L8 -7"
            fill="none"
            stroke="rgb(var(--state-success))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        <style>{`
          @keyframes scanMove {
            0% { transform: translateY(0); opacity: 0; }
            8% { opacity: 0.9; }
            92% { opacity: 0.9; }
            100% { transform: translateY(${PAPER.h}px); opacity: 0; }
          }
          @keyframes scanReveal {
            from { opacity: 0; transform: scale(0.4); }
            to { opacity: 0.85; transform: scale(1); }
          }
          @keyframes scanCheck {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
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
