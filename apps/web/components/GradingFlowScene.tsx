"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// GradingFlowScene — helskärms "Grading Canvas" (Railway-struktur, WiseOS-verktyg)
//
// Hela viewporten blir en prickmönstrad canvas: vänster ikon-rail med
// WiseOS-verktyg (canvas, elevlista, statistik, parametrar, avbryt), top-bar
// med provtitel + status, och elevkort som svävar fritt på ytan.
// Allt är tema-anpassat via CSS-variabler — ljust i light, varmt i cream,
// mörkt i dark.
//
// Props-driven: renderar det state den får. GradingFlowDemo längst ned
// simulerar hela flödet för /design-lab.
// ============================================================================

export type FlowPhase = "uploading" | "processing" | "saving" | "complete" | "error";

export type FlowStudent = {
  id: string;
  name: string;
  status: "queued" | "working" | "done" | "merged" | "failed";
  score?: number;
  maxScore?: number;
  percentage?: number;
  /** Satt när resultatet är persisterat — gör kortet klickbart till granskning. */
  resultId?: string;
};

export type FlowNode = {
  id: string;
  label: string;
  desc: string;
  live: boolean;
};

export type FlowParam = { label: string; value: string };

type RailTool = "canvas" | "students" | "stats" | "settings";

// ---------------------------------------------------------------------------
// Ikoner — tunna linje-ikoner i samma stil som LineIcon
// ---------------------------------------------------------------------------
function RailIcon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="6" height="6" rx="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="7.5" cy="6.5" r="2.75" />
          <path d="M3 16.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" />
          <circle cx="14" cy="7.5" r="2" />
          <path d="M14.5 12.7c1.7.3 2.7 1.5 3 3.3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 17h14" />
          <path d="M5.5 17v-6M10 17V8M14.5 17v-9" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.4 1.4M13.55 13.55l1.4 1.4M14.95 5.05l-1.4 1.4M6.45 13.55l-1.4 1.4" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Dot-grid canvas — tema-anpassad via CSS-variabler
// ---------------------------------------------------------------------------
function DotGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(var(--foreground) / 0.10) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Mjuk vignett mot kanterna i bakgrundsfärgen */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgb(var(--background) / 0.9) 100%)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elevkort — svävar på canvasen, ploppar in med fjäder
// ---------------------------------------------------------------------------
function StudentCard({
  student,
  index,
  onOpen,
}: {
  student: FlowStudent;
  index: number;
  onOpen?: (resultId: string) => void;
}) {
  const done = student.status === "done";
  const working = student.status === "working";
  const merged = student.status === "merged";
  const failed = student.status === "failed";
  const clickable = done && !!student.resultId && !!onOpen;

  // Rent grid — ingen tilt eller vertikal-offset. Korten ska ligga i raka
  // rader/kolumner för maximal skannbarhet efter rättning.

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.9, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      className="relative w-full"
      onClick={clickable ? () => onOpen(student.resultId!) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(student.resultId!);
              }
            }
          : undefined
      }
      style={clickable ? { cursor: "pointer" } : undefined}
    >
      <motion.div
        className="rounded-2xl border px-4 py-3.5 transition-shadow hover:shadow-lg"
        style={{
          borderColor: done
            ? "rgb(var(--state-success) / 0.35)"
            : failed
            ? "rgb(var(--state-danger) / 0.35)"
            : working
            ? "rgb(var(--foreground) / 0.24)"
            : "rgb(var(--hairline) / 0.10)",
          background: done
            ? "rgb(var(--state-success) / 0.07)"
            : failed
            ? "rgb(var(--state-danger) / 0.06)"
            : working
            ? "rgb(var(--surface-elevated))"
            : "rgb(var(--surface) / 0.85)",
          boxShadow: "0 10px 32px rgb(var(--foreground) / 0.08)",
          touchAction: "none",
        }}
      >
        <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2 shrink-0">
          {done ? (
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ background: "rgb(var(--state-success))" }}
            />
          ) : failed ? (
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ background: "rgb(var(--state-danger))" }}
            />
          ) : working ? (
            <>
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: "rgb(var(--foreground) / 0.58)" }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "rgb(var(--foreground) / 0.58)" }}
              />
            </>
          ) : (
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ background: "rgb(var(--foreground) / 0.18)" }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-[rgb(var(--foreground))]">
            {student.name}
          </div>
          <div className="text-[11px] text-[rgb(var(--muted-2))]">
            {done
              ? `${student.score?.toFixed(1) ?? "–"} / ${student.maxScore ?? "–"} poäng${clickable ? " · granska" : ""}`
              : working
              ? "Analyserar…"
              : merged
              ? "Slås samman"
              : failed
              ? "Kunde inte analyseras"
              : "I kö"}
          </div>
        </div>
        <AnimatePresence>
          {done && student.percentage !== undefined && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums"
              style={{
                background:
                  student.percentage >= 70
                    ? "rgb(var(--state-success) / 0.14)"
                    : student.percentage >= 50
                    ? "rgb(var(--state-warning) / 0.16)"
                    : "rgb(var(--state-danger) / 0.14)",
                color:
                  student.percentage >= 70
                    ? "rgb(var(--state-success))"
                    : student.percentage >= 50
                    ? "rgb(var(--state-warning))"
                    : "rgb(var(--state-danger))",
              }}
            >
              {Math.round(student.percentage)}%
            </motion.span>
          )}
        </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Status-pill i top-baren
// ---------------------------------------------------------------------------
function StatusPill({ phase, doneCount, totalCount }: { phase: FlowPhase; doneCount: number; totalCount: number }) {
  const isComplete = phase === "complete";
  const isError = phase === "error";
  const label = isError
    ? "Ett fel uppstod"
    : isComplete
    ? "Rättning klar"
    : phase === "saving"
    ? "Sparar resultat"
    : phase === "uploading"
    ? "Laddar upp"
    : "Analyserar";

  return (
    <div
      className="flex items-center gap-3 rounded-full border px-4 py-2 backdrop-blur-sm"
      style={{
        borderColor: "rgb(var(--hairline) / 0.10)",
        background: "rgb(var(--surface-elevated) / 0.9)",
      }}
    >
      <span className="relative flex h-2 w-2">
        {isComplete ? (
          <span className="inline-flex h-2 w-2 rounded-full" style={{ background: "rgb(var(--state-success))" }} />
        ) : isError ? (
          <span className="inline-flex h-2 w-2 rounded-full" style={{ background: "rgb(var(--state-danger))" }} />
        ) : (
          <>
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: "rgb(var(--foreground) / 0.58)" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: "rgb(var(--foreground) / 0.58)" }}
            />
          </>
        )}
      </span>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--muted))]">
        {label}
      </span>
      <span className="text-[12px] tabular-nums text-[rgb(var(--muted-2))]">
        {doneCount} / {totalCount}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verktygsrad — vänster ikon-rail
// ---------------------------------------------------------------------------
function RailButton({
  icon,
  label,
  active,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-xl transition-all active:scale-95"
      style={{
        background: active ? "rgb(var(--foreground) / 0.08)" : "transparent",
        color: danger
          ? "rgb(var(--state-danger))"
          : active
          ? "rgb(var(--foreground))"
          : "rgb(var(--muted-2))",
      }}
    >
      <RailIcon name={icon} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sidopanel — elevlista / statistik / parametrar (höger sida)
// ---------------------------------------------------------------------------
function SidePanel({
  tool,
  students,
  params,
  onClose,
  onOpen,
}: {
  tool: Exclude<RailTool, "canvas">;
  students: FlowStudent[];
  params?: FlowParam[];
  onClose: () => void;
  onOpen?: (resultId: string) => void;
}) {
  const done = students.filter((s) => s.status === "done" && s.percentage !== undefined);
  const avg = done.length
    ? done.reduce((a, s) => a + (s.percentage ?? 0), 0) / done.length
    : null;
  const sorted = [...done].sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0));
  const median = sorted.length
    ? sorted[Math.floor(sorted.length / 2)].percentage ?? null
    : null;
  const buckets = [
    { label: "0–49%", count: done.filter((s) => (s.percentage ?? 0) < 50).length, color: "rgb(var(--state-danger))" },
    { label: "50–69%", count: done.filter((s) => (s.percentage ?? 0) >= 50 && (s.percentage ?? 0) < 70).length, color: "rgb(var(--state-warning))" },
    { label: "70–100%", count: done.filter((s) => (s.percentage ?? 0) >= 70).length, color: "rgb(var(--state-success))" },
  ];
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const title =
    tool === "students" ? "Elever" : tool === "stats" ? "Statistik" : "Rättningsparametrar";

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="absolute inset-x-3 bottom-3 top-auto z-20 flex max-h-[55vh] w-auto flex-col overflow-hidden rounded-2xl border backdrop-blur-md sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-[72px] sm:max-h-none sm:w-[300px]"
      style={{
        borderColor: "rgb(var(--hairline) / 0.12)",
        background: "rgb(var(--surface-elevated) / 0.92)",
        boxShadow: "0 16px 48px rgb(var(--foreground) / 0.12)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "rgb(var(--hairline) / 0.08)" }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--muted))]">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng panel"
          className="grid h-6 w-6 place-items-center rounded-md transition-colors"
          style={{ color: "rgb(var(--muted-2))" }}
        >
          <RailIcon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tool === "students" && (
          <div className="flex flex-col gap-1">
            {students.length === 0 && (
              <div className="px-2 py-6 text-center text-[12px] text-[rgb(var(--muted-2))]">
                Inga elever ännu
              </div>
            )}
            {students.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                style={{
                  background: "rgb(var(--surface) / 0.6)",
                  cursor: s.status === "done" && s.resultId && onOpen ? "pointer" : undefined,
                }}
                onClick={
                  s.status === "done" && s.resultId && onOpen
                    ? () => onOpen(s.resultId!)
                    : undefined
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      s.status === "done"
                        ? "rgb(var(--state-success))"
                        : s.status === "failed"
                        ? "rgb(var(--state-danger))"
                        : s.status === "working"
                        ? "rgb(var(--foreground) / 0.58)"
                        : s.status === "merged"
                        ? "rgb(var(--foreground) / 0.35)"
                        : "rgb(var(--foreground) / 0.18)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[rgb(var(--foreground))]">
                  {s.name}
                </span>
                <span className="text-[11.5px] tabular-nums text-[rgb(var(--muted-2))]">
                  {s.status === "done"
                    ? `${s.score?.toFixed(1) ?? "–"} p`
                    : s.status === "failed"
                    ? "fel"
                    : s.status === "working"
                    ? "…"
                    : s.status === "merged"
                    ? "→"
                    : "kö"}
                </span>
              </div>
            ))}
          </div>
        )}

        {tool === "stats" && (
          <div className="flex flex-col gap-4 p-1">
            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgb(var(--hairline) / 0.10)", background: "rgb(var(--surface) / 0.6)" }}
              >
                <div className="text-[10px] uppercase tracking-[0.1em] text-[rgb(var(--muted-2))]">Snitt</div>
                <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-[rgb(var(--foreground))]">
                  {avg !== null ? `${Math.round(avg)}%` : "–"}
                </div>
              </div>
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgb(var(--hairline) / 0.10)", background: "rgb(var(--surface) / 0.6)" }}
              >
                <div className="text-[10px] uppercase tracking-[0.1em] text-[rgb(var(--muted-2))]">Median</div>
                <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-[rgb(var(--foreground))]">
                  {median !== null ? `${Math.round(median)}%` : "–"}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[rgb(var(--muted-2))]">
                Fördelning
              </div>
              <div className="flex flex-col gap-2">
                {buckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="w-14 text-[11px] tabular-nums text-[rgb(var(--muted))]">{b.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgb(var(--foreground) / 0.06)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: b.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(b.count / maxBucket) * 100}%` }}
                        transition={{ type: "spring", damping: 26, stiffness: 200 }}
                      />
                    </div>
                    <span className="w-5 text-right text-[11px] tabular-nums text-[rgb(var(--muted-2))]">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {done.length === 0 && (
              <div className="py-4 text-center text-[12px] text-[rgb(var(--muted-2))]">
                Statistik visas när första eleven är klar
              </div>
            )}
          </div>
        )}

        {tool === "settings" && (
          <div className="flex flex-col gap-1.5 p-1">
            {(params ?? []).length === 0 && (
              <div className="px-2 py-6 text-center text-[12px] text-[rgb(var(--muted-2))]">
                Standardparametrar används
              </div>
            )}
            {(params ?? []).map((p) => (
              <div
                key={p.label}
                className="flex items-center justify-between rounded-lg px-2.5 py-2"
                style={{ background: "rgb(var(--surface) / 0.6)" }}
              >
                <span className="text-[12px] text-[rgb(var(--muted))]">{p.label}</span>
                <span className="text-[12px] font-medium text-[rgb(var(--foreground))]">{p.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

// ---------------------------------------------------------------------------
// Huvudscen — helskärm
// ---------------------------------------------------------------------------
export default function GradingFlowScene({
  provTitle,
  phase,
  students,
  totalCount,
  params,
  error,
  onClose,
  onReview,
  onOpenResult,
}: {
  provTitle: string;
  phase: FlowPhase;
  nodes?: FlowNode[]; // bevarat för bakåtkompatibilitet — renderas inte i canvas-vyn
  students: FlowStudent[];
  totalCount: number;
  params?: FlowParam[];
  error?: string | null;
  onClose?: () => void;
  onReview?: () => void;
  onOpenResult?: (resultId: string) => void;
}) {
  const [activeTool, setActiveTool] = useState<RailTool>("canvas");
  const doneCount = students.filter((s) => s.status === "done").length;
  const isComplete = phase === "complete";
  const isError = phase === "error";

  const toggleTool = (t: RailTool) =>
    setActiveTool((prev) => (prev === t ? "canvas" : t));

  return (
    <div
      className="relative flex h-full w-full overflow-hidden"
      style={{ background: "rgb(var(--background))" }}
    >
      <DotGrid />

      {/* Vänster verktygsrad */}
      <motion.nav
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, type: "spring", damping: 26, stiffness: 280 }}
        className="relative z-20 flex w-11 shrink-0 flex-col items-center gap-1.5 border-r py-3 sm:w-14 sm:py-4"
        style={{
          borderColor: "rgb(var(--hairline) / 0.08)",
          background: "rgb(var(--surface) / 0.5)",
        }}
        aria-label="Rättningsverktyg"
      >
        <RailButton icon="grid" label="Canvas" active={activeTool === "canvas"} onClick={() => setActiveTool("canvas")} />
        <RailButton icon="users" label="Elevlista" active={activeTool === "students"} onClick={() => toggleTool("students")} />
        <RailButton icon="chart" label="Statistik" active={activeTool === "stats"} onClick={() => toggleTool("stats")} />
        <RailButton icon="settings" label="Parametrar" active={activeTool === "settings"} onClick={() => toggleTool("settings")} />
        <div className="flex-1" />
        {onClose && <RailButton icon="x" label="Stäng vyn — rättningen fortsätter" onClick={onClose} />}
      </motion.nav>

      {/* Höger yta: top-bar + canvas */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top-bar */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, type: "spring", damping: 26, stiffness: 280 }}
          className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:gap-4 sm:px-5"
          style={{ borderColor: "rgb(var(--hairline) / 0.08)" }}
        >
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="hidden shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))] sm:inline">
              {isError
                ? "Rättning avbruten"
                : isComplete
                ? "WiseOS har rättat hela klassen"
                : "WiseOS rättar hela klassen"}
            </span>
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-[rgb(var(--foreground))]">
              {provTitle}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <StatusPill phase={phase} doneCount={doneCount} totalCount={totalCount} />
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Stäng"
                className="grid h-9 w-9 place-items-center rounded-lg border transition-colors sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
                style={{
                  borderColor: "rgb(var(--hairline) / 0.12)",
                  color: "rgb(var(--muted))",
                  background: "rgb(var(--surface-elevated) / 0.8)",
                }}
              >
                <RailIcon name="x" className="h-4 w-4 sm:hidden" />
                <span className="hidden text-[12px] sm:inline">Stäng</span>
              </button>
            )}
          </div>
        </motion.header>

        {/* Canvas med elevkort i rent grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="relative flex-1 overflow-y-auto"
        >
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 px-4 py-6 sm:grid-cols-2 sm:gap-4 sm:px-8 sm:py-12 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {students.map((s, i) => (
                <StudentCard key={s.id} student={s} index={i} onOpen={onOpenResult} />
              ))}
            </AnimatePresence>
          </div>

          {students.length === 0 && !isError && (
            <div className="mt-16 text-center text-[13px] text-[rgb(var(--muted-2))]">
              Förbereder uppladdning…
            </div>
          )}

          {isError && error && (
            <div
              className="mx-auto mt-8 max-w-lg rounded-xl border px-5 py-4 text-[13px]"
              style={{
                borderColor: "rgb(var(--state-danger) / 0.3)",
                background: "rgb(var(--state-danger) / 0.08)",
                color: "rgb(var(--state-danger))",
              }}
            >
              {error}
            </div>
          )}
        </motion.div>
      </div>

      {/* Sidopanel för valt verktyg */}
      <AnimatePresence>
        {activeTool !== "canvas" && (
          <SidePanel
            tool={activeTool}
            students={students}
            params={params}
            onClose={() => setActiveTool("canvas")}
            onOpen={onOpenResult}
          />
        )}
      </AnimatePresence>

      {/* Completion toast */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 300, delay: 0.25 }}
            className="absolute inset-x-3 bottom-4 z-30 mx-auto w-fit max-w-full sm:inset-x-0 sm:bottom-6"
          >
            <div
              className="flex flex-col items-stretch gap-4 rounded-2xl border px-5 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:gap-5 sm:px-6"
              style={{
                borderColor: "rgb(var(--state-success) / 0.3)",
                background: "rgb(var(--surface-elevated) / 0.95)",
                boxShadow: "0 16px 48px rgb(var(--foreground) / 0.14)",
              }}
            >
              <div className="flex items-center gap-3">
                <motion.span
                  className="grid h-8 w-8 place-items-center rounded-full"
                  style={{ background: "rgb(var(--state-success) / 0.14)" }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg
                    className="h-4 w-4"
                    style={{ color: "rgb(var(--state-success))" }}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
                <div>
                  <div className="text-[13.5px] font-semibold text-[rgb(var(--foreground))]">
                    Prov klart — alla {doneCount} elevprov analyserade
                  </div>
                  <div className="text-[11.5px] text-[rgb(var(--muted-2))]">
                    Resultaten är validerade och redo för granskning
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {onReview && (
                  <button
                    onClick={onReview}
                    className="rounded-lg px-4 py-2.5 text-[12.5px] font-semibold transition-colors sm:py-2"
                    style={{
                      background: "rgb(var(--foreground))",
                      color: "rgb(var(--background))",
                    }}
                  >
                    Granska prov →
                  </button>
                )}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2.5 text-[12.5px] font-medium transition-colors sm:py-2"
                    style={{
                      borderColor: "rgb(var(--hairline) / 0.15)",
                      color: "rgb(var(--muted))",
                    }}
                  >
                    Stäng
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// GradingFlowDemo — självgående simulation för /design-lab
// ============================================================================

const DEMO_STUDENTS = [
  "Anna Lindqvist",
  "Erik Johansson",
  "Sara Nilsson",
  "Lucas Bergström",
  "Maja Karlsson",
  "Oscar Holm",
];

const DEMO_PARAMS: FlowParam[] = [
  { label: "Delpoäng", value: "Ja" },
  { label: "Enhetsfel", value: "-0,5 p" },
  { label: "Avrundningstolerans", value: "5%" },
  { label: "Kräv redovisning", value: "Ja" },
];

export function GradingFlowDemo({ onClose }: { onClose?: () => void }) {
  const [phase, setPhase] = useState<FlowPhase>("uploading");
  const [students, setStudents] = useState<FlowStudent[]>([]);
  const [runId, setRunId] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    const t = (ms: number, fn: () => void) =>
      timersRef.current.push(window.setTimeout(fn, ms));

    setPhase("uploading");
    setStudents([]);

    t(900, () => setPhase("processing"));

    DEMO_STUDENTS.forEach((name, i) => {
      const base = 1400 + i * 1100;
      t(base, () =>
        setStudents((prev) => [...prev, { id: `s${i}`, name, status: "working" }]),
      );
      t(base + 1600 + Math.random() * 600, () =>
        setStudents((prev) =>
          prev.map((s) =>
            s.id === `s${i}`
              ? {
                  ...s,
                  status: "done",
                  score: 12 + Math.random() * 10,
                  maxScore: 24,
                  percentage: 45 + Math.random() * 50,
                }
              : s,
          ),
        ),
      );
    });

    const lastDone = 1400 + DEMO_STUDENTS.length * 1100 + 2200;
    t(lastDone, () => setPhase("saving"));
    t(lastDone + 900, () => setPhase("complete"));

    return () => timersRef.current.forEach((x) => window.clearTimeout(x));
  }, [runId]);

  return (
    <div className="fixed inset-0">
      <GradingFlowScene
        provTitle="Matematik 1c — Kapitalprov 3"
        phase={phase}
        students={students}
        totalCount={DEMO_STUDENTS.length}
        params={DEMO_PARAMS}
        onClose={onClose}
        onReview={() => setRunId((n) => n + 1)}
      />
      <button
        onClick={() => setRunId((n) => n + 1)}
        className="absolute right-4 top-[72px] z-40 rounded-lg border px-3 py-1.5 text-[11.5px] font-medium backdrop-blur transition-colors"
        style={{
          borderColor: "rgb(var(--hairline) / 0.15)",
          background: "rgb(var(--surface-elevated) / 0.8)",
          color: "rgb(var(--muted))",
        }}
      >
        ↻ Kör om demo
      </button>
    </div>
  );
}
