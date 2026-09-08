"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 14;
const ROWS = 10;
const TOTAL = COLS * ROWS;
const CELL_SIZE = 10;

type CellState = 0 | 1 | 2;
type CellVariation = {
  size: number;
  radius: number;
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

    const cycleCell = (index: number) => {
      // idle -> active (ring appears)
      setStates((current) => replaceState(current, index, 1));
      later(() => {
        // active -> done (cell fills + check draws)
        setStates((current) => replaceState(current, index, 2));
        later(() => {
          // done -> idle (everything fades out)
          setStates((current) => replaceState(current, index, 0));
        }, 9000 + random() * 7000);
      }, 1800 + random() * 700);
    };

    const scheduleNext = () => {
      later(() => {
        setStates((current) => {
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
      }, 2200 + random() * 1300);
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
  const active = state === 1;
  const done = state === 2;
  const size = 7.0 * (compact ? 0.92 : 1) + variation.size;
  const inset = (7.3 - size) / 2 + variation.offset;
  const radius = 1.5 + variation.radius;
  const fadeMs = reduceMotion ? "0ms" : "420ms";
  const drawMs = reduceMotion ? "0ms" : "460ms";

  return (
    <g transform={`translate(${x * CELL_SIZE}, ${y * CELL_SIZE})`}>
      {/* Resting cell — faint, uniform base */}
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={radius}
        fill="currentColor"
        style={{ opacity: 0.05 }}
      />

      {/* Active state — a visible but quiet ring, like in the reference */}
      <rect
        x={inset + 0.5}
        y={inset + 0.5}
        width={size - 1}
        height={size - 1}
        rx={radius - 0.3}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.9}
        style={{
          opacity: active ? 0.28 : 0,
          transform: active ? "scale(1)" : "scale(0.94)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${fadeMs} cubic-bezier(0.22, 0.8, 0.36, 1), transform ${fadeMs} cubic-bezier(0.22, 0.8, 0.36, 1)`,
        }}
      />

      {/* Done state — soft filled cell, clearly readable but not loud */}
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={radius}
        fill="currentColor"
        style={{
          opacity: done ? 0.18 : 0,
          transform: done ? "scale(1)" : "scale(0.96)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${fadeMs} cubic-bezier(0.22, 0.8, 0.36, 1), transform ${fadeMs} cubic-bezier(0.22, 0.8, 0.36, 1)`,
        }}
      />

      {/* Checkmark — drawn with a stroke, like a pen */}
      <path
        d={`M${inset + size * 0.25} ${inset + size * 0.52} L${inset + size * 0.43} ${inset + size * 0.70} L${inset + size * 0.76} ${inset + size * 0.33}`}
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(0.9, size * 0.15)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        style={{
          opacity: done ? 0.72 : 0,
          strokeDashoffset: done ? 0 : 1,
          transition: `stroke-dashoffset ${drawMs} cubic-bezier(0.45, 0, 0.55, 1), opacity ${reduceMotion ? "0ms" : "160ms"} ease-out`,
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
    size: random() * 0.22,
    radius: random() * 0.18,
    offset: (random() - 0.5) * 0.08,
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
