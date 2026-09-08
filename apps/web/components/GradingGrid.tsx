"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 14;
const ROWS = 10;
const TOTAL = COLS * ROWS;
const CELL_SIZE = 10;

// Three states only: idle, active (AI looking), done (check drawn)
type CellState = 0 | 1 | 2;
type CellVariation = {
  size: number;
  radius: number;
  opacity: number;
  offset: number;
};

export default function GradingGrid({
  className = "",
  seed = 42,
  compact = false,
}: {
  className?: string;
  seed?: number;
  compact?: boolean;
}) {
  const runtimeRandom = useRef(seededRandom(seed * 17 + 11));
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const variations = useMemo(
    () => Array.from({ length: TOTAL }, (_, index) => cellVariation(seed, index)),
    [seed],
  );
  const [states, setStates] = useState<CellState[]>(() => initialStates(seed));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reduceMotion || compact) return;

    let cancelled = false;
    const random = runtimeRandom.current;
    const activeTimers = timers.current;

    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        activeTimers.delete(timer);
        if (!cancelled) callback();
      }, delay);
      activeTimers.add(timer);
    };

    // Lifecycle of one cell: idle -> active -> done -> (hold) -> idle
    const cycleCell = (index: number) => {
      // idle -> active
      setStates((current) => replaceState(current, index, 1));
      // active holds ~1.6–2.4s, then -> done
      later(() => {
        setStates((current) => replaceState(current, index, 2));
        // done holds 8–15s, then fades back to idle
        later(() => {
          setStates((current) => replaceState(current, index, 0));
        }, 8000 + random() * 7000);
      }, 1600 + random() * 800);
    };

    // Low, irregular cadence: one cell every ~2–3s, never simultaneous, never predictable
    const scheduleNext = () => {
      later(() => {
        setStates((current) => {
          // Prefer idle cells; if none idle, pick a done cell to recycle
          const idle = current.flatMap((state, i) => (state === 0 ? [i] : []));
          const pool = idle.length > 0
            ? idle
            : current.flatMap((state, i) => (state === 2 ? [i] : []));
          if (pool.length > 0) {
            const index = pool[Math.floor(random() * pool.length)];
            later(() => cycleCell(index), 0);
          }
          return current;
        });
        scheduleNext();
      }, 2000 + random() * 1000);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, [reduceMotion, compact]);

  return (
    <svg
      viewBox={`0 0 ${COLS * CELL_SIZE + 2} ${ROWS * CELL_SIZE + 2}`}
      className={`h-full w-full ${className}`}
      style={{ shapeRendering: "geometricPrecision" }}
      aria-hidden="true"
    >
      <g transform="translate(1,1)">
        {states.map((state, index) => (
          <Cell
            key={index}
            state={state}
            x={index % COLS}
            y={Math.floor(index / COLS)}
            variation={variations[index]}
            compact={compact}
            reduceMotion={reduceMotion}
          />
        ))}
      </g>
    </svg>
  );
}

function Cell({
  state,
  x,
  y,
  variation,
  compact,
  reduceMotion,
}: {
  state: CellState;
  x: number;
  y: number;
  variation: CellVariation;
  compact: boolean;
  reduceMotion: boolean;
}) {
  const idle = state === 0;
  const active = state === 1;
  const done = state === 2;
  const size = variation.size * (compact ? 0.92 : 1);
  const inset = (7.3 - size) / 2 + variation.offset;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const fadeMs = reduceMotion ? "0ms" : "400ms";
  const checkMs = reduceMotion ? "0ms" : "420ms";

  return (
    <g transform={`translate(${x * CELL_SIZE}, ${y * CELL_SIZE})`}>
      {/* Resting cell — very faint base */}
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={variation.radius}
        fill="currentColor"
        style={{ opacity: variation.opacity * 0.06 }}
      />

      {/* Active glow — subtle inner border, fades in 400ms ease-out */}
      <rect
        x={inset - 0.6}
        y={inset - 0.6}
        width={size + 1.2}
        height={size + 1.2}
        rx={variation.radius + 0.5}
        fill="none"
        stroke="rgb(var(--accent))"
        strokeWidth={0.7}
        style={{
          opacity: active ? 0.38 : 0,
          transform: active ? "scale(1)" : "scale(0.92)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${fadeMs} ${ease}, transform ${fadeMs} ${ease}`,
        }}
      />

      {/* Done background — 2–4% tone shift, not white-on-black */}
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={variation.radius}
        fill="currentColor"
        style={{
          opacity: done ? variation.opacity * 0.10 : 0,
          transform: done ? "scale(1)" : "scale(0.94)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${fadeMs} ${ease}, transform ${fadeMs} ${ease}`,
        }}
      />

      {/* Checkmark — drawn via stroke-dasharray, 420ms ease-in-out */}
      <path
        d={`M${inset + size * 0.25} ${inset + size * 0.52} L${inset + size * 0.43} ${inset + size * 0.69} L${inset + size * 0.76} ${inset + size * 0.34}`}
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(0.82, size * 0.14)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        style={{
          opacity: done ? 0.75 : 0,
          strokeDashoffset: done ? 0 : 1,
          transition: `stroke-dashoffset ${checkMs} cubic-bezier(0.42, 0, 0.58, 1), opacity ${reduceMotion ? "0ms" : "180ms"} ease-out`,
        }}
      />
    </g>
  );
}

function initialStates(seed: number): CellState[] {
  const random = seededRandom(seed);
  return Array.from({ length: TOTAL }, () => {
    if (random() >= 0.08) return 0;
    return 2;
  });
}

function cellVariation(seed: number, index: number): CellVariation {
  const random = seededRandom(seed * 1009 + index * 97 + 13);
  return {
    size: 6.75 + random() * 0.5,
    radius: 1.25 + random() * 0.35,
    opacity: 0.92 + random() * 0.08,
    offset: (random() - 0.5) * 0.12,
  };
}

function replaceState(states: CellState[], index: number, state: CellState): CellState[] {
  if (states[index] === state) return states;
  const next = [...states];
  next[index] = state;
  return next;
}

function seededRandom(seed: number): () => number {
  let current = Math.abs(seed) || 1;
  return () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };
}
