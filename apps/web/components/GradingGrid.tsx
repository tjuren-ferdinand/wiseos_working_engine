"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 16;
const ROWS = 10;
const TOTAL = COLS * ROWS;
const GAP_X = 22;
const GAP_Y = 22;

type DotState = 0 | 1 | 2; // idle, pulse, checked

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
  const [states, setStates] = useState<DotState[]>(() => initialStates(seed));
  const statesRef = useRef(states);
  const [travel, setTravel] = useState<{ from: number; to: number; progress: number } | null>(null);

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

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

    const pickNextIndex = () => {
      const idle = statesRef.current.flatMap((state, i) => (state === 0 ? [i] : []));
      const pool = idle.length > 0 ? idle : statesRef.current.flatMap((state, i) => (state === 2 ? [i] : []));
      return pool.length > 0 ? pool[Math.floor(random() * pool.length)] : -1;
    };

    const travelDuration = 1200 + random() * 600;
    const pulseDuration = 1400 + random() * 600;
    const holdDuration = 8000 + random() * 5000;

    const scheduleTravel = (fromIndex: number, toIndex: number) => {
      const steps = 30;
      const stepTime = travelDuration / steps;

      for (let i = 0; i <= steps; i++) {
        later(() => {
          setTravel({ from: fromIndex, to: toIndex, progress: i / steps });
        }, i * stepTime);
      }

      later(() => {
        setTravel(null);
        setStates((current) => replaceState(current, toIndex, 1));

        later(() => {
          const willCheck = random() < 0.26;
          setStates((current) => replaceState(current, toIndex, willCheck ? 2 : 0));

          if (willCheck) {
            later(() => {
              setStates((current) => replaceState(current, toIndex, 0));
              const next = pickNextIndex();
              if (next !== -1) scheduleTravel(toIndex, next);
            }, holdDuration);
          } else {
            const next = pickNextIndex();
            if (next !== -1) scheduleTravel(toIndex, next);
          }
        }, pulseDuration);
      }, travelDuration);
    };

    const first = pickNextIndex();
    if (first !== -1) {
      const second = pickNextIndex();
      scheduleTravel(first, second !== -1 ? second : first);
    }

    return () => {
      cancelled = true;
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, compact, seed]);

  const positions = useMemo(() => {
    return Array.from({ length: TOTAL }, (_, i) => ({
      x: (i % COLS) * GAP_X + GAP_X / 2,
      y: Math.floor(i / COLS) * GAP_Y + GAP_Y / 2,
    }));
  }, []);

  const width = COLS * GAP_X;
  const height = ROWS * GAP_Y;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-full w-full ${className}`}
      style={{ shapeRendering: "geometricPrecision" }}
      aria-hidden="true"
    >
      <defs>
        <mask id="vignette">
          <rect width={width} height={height} fill="white" />
          <radialGradient id="vignetteGradient">
            <stop offset="25%" stopColor="black" />
            <stop offset="100%" stopColor="white" />
          </radialGradient>
          <rect width={width} height={height} fill="url(#vignetteGradient)" opacity="0.95" />
        </mask>
      </defs>

      <g mask="url(#vignette)">
        {travel && !compact && (
          <ConnectionLine travel={travel} positions={positions} />
        )}

        {positions.map((p, i) => (
          <Dot
            key={i}
            cx={p.x}
            cy={p.y}
            state={states[i]}
            compact={compact}
            reduceMotion={reduceMotion}
          />
        ))}

        {travel && !compact && (
          <TravelPulse travel={travel} positions={positions} />
        )}
      </g>
    </svg>
  );
}

function Dot({
  cx,
  cy,
  state,
  compact,
  reduceMotion,
}: {
  cx: number;
  cy: number;
  state: DotState;
  compact: boolean;
  reduceMotion: boolean;
}) {
  const pulse = state === 1;
  const checked = state === 2;
  const duration = reduceMotion ? "0ms" : "480ms";
  const drawMs = reduceMotion ? "0ms" : "460ms";
  const r = compact ? 1.8 : 2.8;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Resting dot */}
      <circle r={r} fill="currentColor" style={{ opacity: 0.22 }} />

      {/* Active outer ring */}
      <circle
        r={r * 2.2}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.9}
        style={{
          opacity: pulse ? 0.40 : 0,
          transform: pulse ? "scale(1)" : "scale(0.82)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${duration} cubic-bezier(0.22, 0.9, 0.36, 1), transform ${duration} cubic-bezier(0.22, 0.9, 0.36, 1)`,
        }}
      />

      {/* Active inner glow */}
      <circle
        r={r}
        fill="currentColor"
        style={{
          opacity: pulse ? 0.28 : 0,
          transform: pulse ? "scale(2.2)" : "scale(1)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${duration} cubic-bezier(0.22, 0.9, 0.36, 1), transform ${duration} cubic-bezier(0.22, 0.9, 0.36, 1)`,
        }}
      />

      {/* Checked fill */}
      <circle
        r={r * 2.0}
        fill="currentColor"
        style={{
          opacity: checked ? 0.18 : 0,
          transform: checked ? "scale(1)" : "scale(0.9)",
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: `opacity ${duration} cubic-bezier(0.22, 0.9, 0.36, 1), transform ${duration} cubic-bezier(0.22, 0.9, 0.36, 1)`,
        }}
      />

      {/* Checkmark */}
      <path
        d={`M${-r * 0.62} ${r * 0.02} L${-r * 0.08} ${r * 0.68} L${r * 0.75} ${-r * 0.58}`}
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(0.85, r * 0.34)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        style={{
          opacity: checked ? 0.82 : 0,
          strokeDashoffset: checked ? 0 : 1,
          transition: `stroke-dashoffset ${drawMs} cubic-bezier(0.45, 0, 0.55, 1), opacity ${reduceMotion ? "0ms" : "160ms"} ease-out`,
        }}
      />
    </g>
  );
}

function TravelPulse({
  travel,
  positions,
}: {
  travel: { from: number; to: number; progress: number };
  positions: { x: number; y: number }[];
}) {
  const { from, to, progress } = travel;
  const start = positions[from] ?? positions[to];
  const end = positions[to];
  const x = start.x + (end.x - start.x) * progress;
  const y = start.y + (end.y - start.y) * progress;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={4.2} fill="none" stroke="currentColor" strokeWidth={1.0} style={{ opacity: 0.45 }} />
      <circle r={4.2} fill="currentColor" style={{ opacity: 0.16 }} />
      <circle r={1.4} fill="currentColor" style={{ opacity: 0.65 }} />
    </g>
  );
}

function ConnectionLine({
  travel,
  positions,
}: {
  travel: { from: number; to: number; progress: number };
  positions: { x: number; y: number }[];
}) {
  const { from, to } = travel;
  const start = positions[from] ?? positions[to];
  const end = positions[to];
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="currentColor"
      strokeWidth={0.6}
      strokeLinecap="round"
      style={{ opacity: 0.08 }}
    />
  );
}

function initialStates(seed: number): DotState[] {
  const random = seededRandom(seed);
  return Array.from({ length: TOTAL }, () => {
    if (random() >= 0.07) return 0;
    return 2;
  });
}

function replaceState(states: DotState[], index: number, state: DotState): DotState[] {
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
