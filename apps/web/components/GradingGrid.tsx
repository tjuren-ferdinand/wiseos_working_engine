"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 14;
const ROWS = 10;
const TOTAL = COLS * ROWS;
const CELL_SIZE = 10;

type CellState = 0 | 1 | 2 | 3 | 4;
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
    if (reduceMotion) return;

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

    const transitionCell = (index: number) => {
      setStates((current) => replaceState(current, index, 1));
      later(() => {
        setStates((current) => replaceState(current, index, 2));
        later(() => {
          const willCheck = random() < 0.22;
          setStates((current) => replaceState(current, index, 3));
          if (willCheck) {
            later(
              () => setStates((current) => replaceState(current, index, 4)),
              420 + random() * 180,
            );
          }
        }, 480 + random() * 180);
      }, 460 + random() * 180);
    };

    const scheduleNext = () => {
      later(() => {
        setStates((current) => {
          const index = pickEmptyCell(current, random);
          if (index !== -1) later(() => transitionCell(index), 0);
          return current;
        });
        scheduleNext();
      }, 600 + random() * 1200);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, [reduceMotion]);

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
  const queued = state === 1;
  const processing = state === 2;
  const settled = state >= 3;
  const checked = state === 4;
  const size = variation.size * (compact ? 0.92 : 1);
  const inset = (7.3 - size) / 2 + variation.offset;
  const duration = reduceMotion ? "0ms" : "520ms";
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <g transform={`translate(${x * CELL_SIZE}, ${y * CELL_SIZE})`}>
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={variation.radius}
        fill="currentColor"
        style={{ opacity: variation.opacity * 0.07 }}
      />
      <rect
        x={inset - 0.65}
        y={inset - 0.65}
        width={size + 1.3}
        height={size + 1.3}
        rx={variation.radius + 0.5}
        fill="none"
        stroke="rgb(var(--accent))"
        strokeWidth={processing ? 0.8 : 0.55}
        style={{
          opacity: queued ? 0.18 : processing ? 0.42 : 0,
          transform: queued ? "scale(0.93)" : "scale(1)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${duration} ${easing}, transform ${duration} ${easing}, stroke-width ${duration} ${easing}`,
        }}
      />
      <rect
        x={inset}
        y={inset}
        width={size}
        height={size}
        rx={variation.radius}
        fill={processing ? "rgb(var(--accent))" : "currentColor"}
        style={{
          opacity: processing ? variation.opacity * 0.28 : settled ? variation.opacity * 0.9 : 0,
          transform: processing ? "scale(0.94)" : settled ? "scale(1)" : "scale(0.9)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${duration} ${easing}, transform ${duration} ${easing}, fill ${duration} ${easing}`,
        }}
      />
      <path
        d={`M${inset + size * 0.25} ${inset + size * 0.52} L${inset + size * 0.43} ${inset + size * 0.69} L${inset + size * 0.76} ${inset + size * 0.34}`}
        pathLength="1"
        fill="none"
        stroke="rgb(var(--surface))"
        strokeWidth={Math.max(0.82, size * 0.14)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        style={{
          opacity: checked ? 1 : 0,
          strokeDashoffset: checked ? 0 : 1,
          transition: `stroke-dashoffset ${reduceMotion ? "0ms" : "460ms"} ${easing}, opacity ${reduceMotion ? "0ms" : "160ms"} ease-out`,
        }}
      />
    </g>
  );
}

function initialStates(seed: number): CellState[] {
  const random = seededRandom(seed);
  return Array.from({ length: TOTAL }, () => {
    if (random() >= 0.12) return 0;
    return random() < 0.35 ? 4 : 3;
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

function pickEmptyCell(states: CellState[], random: () => number): number {
  const empty = states.flatMap((state, index) => (state === 0 ? [index] : []));
  if (empty.length === 0) return -1;
  return empty[Math.floor(random() * empty.length)];
}

function seededRandom(seed: number): () => number {
  let current = Math.abs(seed) || 1;
  return () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };
}
