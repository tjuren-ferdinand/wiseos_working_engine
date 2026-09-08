"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Generativ visualisering av ett rättningsgrid.
 * Små celler fylls i långsamt och oregelbundet — enstaka markerade med bock.
 * Används på landningssidan och kan återanvändas i dashboard.
 */

const COLS = 14;
const ROWS = 10;
const TOTAL = COLS * ROWS;

// Variations: 0 empty, 1 idle, 2 processing, 3 filled, 4 checked

type CellState = 0 | 1 | 2 | 3 | 4;

export default function GradingGrid({
  className = "",
  seed = 42,
}: {
  className?: string;
  seed?: number;
}) {
  // Deterministic pseudo-random per seed
  const rng = useMemo(() => seededRandom(seed), [seed]);

  const [states, setStates] = useState<CellState[]>(() => {
    const initial: CellState[] = Array(TOTAL).fill(0);
    // Pre-fill ~12% of cells so the grid never looks completely empty
    for (let i = 0; i < TOTAL; i += 1) {
      if (rng() < 0.12) {
        initial[i] = rng() < 0.35 ? 4 : 3;
      }
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      // Low frequency, organic timing: 600–1800ms between updates
      const delay = 600 + rng() * 1200;
      setTimeout(() => {
        if (cancelled) return;
        updateOneCell();
        scheduleNext();
      }, delay);
    };

    const updateOneCell = () => {
      setStates((prev) => {
        const idx = pickCell(prev, rng);
        if (idx === -1) return prev;
        const next = [...prev];
        const current = next[idx];

        if (current === 0) {
          next[idx] = 1; // become idle first
          setTimeout(() => {
            setStates((p) => {
              const n = [...p];
              n[idx] = 2; // start processing
              return n;
            });
            setTimeout(() => {
              setStates((p) => {
                const n = [...p];
                n[idx] = rng() < 0.18 ? 4 : 3; // sometimes checked
                return n;
              });
            }, 250 + rng() * 400);
          }, 120 + rng() * 180);
        } else if (current === 3) {
          // Occasional re-check: filled cell becomes checked
          next[idx] = rng() < 0.3 ? 4 : 3;
        } else if (current === 4) {
          // Occasional un-check
          next[idx] = rng() < 0.15 ? 3 : 4;
        }
        return next;
      });
    };

    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [rng]);

  const cells = useMemo(() => {
    const list = [] as JSX.Element[];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const i = r * COLS + c;
        list.push(
          <Cell
            key={i}
            state={states[i]}
            x={c}
            y={r}
          />,
        );
      }
    }
    return list;
  }, [states]);

  return (
    <svg
      viewBox={`0 0 ${COLS * 10 + 2} ${ROWS * 10 + 2}`}
      className={`w-full h-full ${className}`}
      style={{ shapeRendering: "geometricPrecision" }}
      aria-hidden="true"
    >
      <g transform="translate(1,1)">{cells}</g>
    </svg>
  );
}

function Cell({ state, x, y }: { state: CellState; x: number; y: number }) {
  const processing = state === 2;
  const filled = state === 3 || state === 4;
  const checked = state === 4;

  return (
    <g transform={`translate(${x * 10}, ${y * 10})`}>
      <rect
        width="7"
        height="7"
        rx="1.5"
        className="transition-all duration-500 ease-out"
        style={{
          fill: processing
            ? "rgb(var(--accent) / 0.85)"
            : filled
              ? "currentColor"
              : state === 1
                ? "color-mix(in srgb, currentColor 8%, transparent)"
                : "color-mix(in srgb, currentColor 4%, transparent)",
          opacity: processing ? 0.85 : 1,
          transform: processing ? "scale(1.18)" : "scale(1)",
          transformBox: "fill-box",
          transformOrigin: "center",
          stroke: filled || processing ? "none" : "color-mix(in srgb, currentColor 10%, transparent)",
          strokeWidth: 0.5,
        }}
      />
      {checked && (
        <path
          d="M2.3 3.6 L3.5 4.8 L5.8 2.5"
          fill="none"
          stroke="var(--equi-surface, #ffffff)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-opacity duration-500"
        />
      )}
    </g>
  );
}

function pickCell(states: CellState[], rng: () => number): number {
  // Prefer empty cells; sometimes re-touch already filled cells
  const empty = states
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s === 1 || x.s === 0);
  if (empty.length > 0) {
    return empty[Math.floor(rng() * empty.length)].i;
  }
  // If almost full, occasionally mutate an existing cell
  if (rng() > 0.3) return -1;
  return Math.floor(rng() * states.length);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
