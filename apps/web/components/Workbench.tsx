"use client";

import { useState } from "react";
import {
  actions,
  type StudentResult,
  type Prov,
  type Klass,
  type Step,
} from "@/lib/store";
import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

type Props = {
  result: StudentResult;
  prov: Prov;
  klass: Klass;
  onBack: () => void;
  onPrint: () => void;
};

/** Rubrik som förklarar VARFÖR en uppgift behöver granskas. Ren presentation
 *  av backendens data – ingen text hittas på och inget resultat maskeras. */
function reviewReason(step: Step): string | null {
  if (step.error) return `Tekniskt fel vid rättning: ${step.error}`;
  if (step.found === false) {
    return "Uppgiften hittades inte i det uppladdade dokumentet. Kontrollera att alla sidor är med.";
  }
  if (step.status !== "needs_review") return null;
  if (
    typeof step.transcriptionConfidence === "number" &&
    step.transcriptionConfidence < 0.55 &&
    step.studentWork
  ) {
    return `AI:n är osäker på handstilen (${Math.round(
      step.transcriptionConfidence * 100,
    )}% säkerhet). Kontrollera transkriptionen mot originalet.`;
  }
  return "AI:n har otillräckligt underlag för en säker bedömning.";
}

export default function Workbench({ result, prov, klass, onBack, onPrint }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  // Beräkna total från V2 Step structure
  const total = result.steps.reduce((s, st) => s + st.earnedPoints, 0);
  const max = result.steps.reduce((s, st) => s + st.maxPoints, 0);

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className={`text-sm transition-colors ${isDark ? "text-paper/50 hover:text-paper" : "text-ink-secondary hover:text-ink"}`}>← Tillbaka till klassmapp</button>
          <div className="flex items-center gap-3">
            <button
              onClick={onPrint}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${isDark ? "border-paper-raised/20 bg-paper-raised/5 text-paper hover:bg-paper-raised/10" : "border-ink-hairline bg-paper-raised text-ink hover:bg-paper-secondary"}`}
            >
              Skriv ut genomgång + Original-PDF
            </button>
          </div>
        </div>

      <header className={`rounded-2xl border p-6 flex flex-wrap items-center justify-between gap-4 ${isDark ? "border-paper-raised/10 bg-paper-raised/5" : "border-ink-hairline bg-paper-raised shadow-sm"}`}>
        <div>
          <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${"text-ink-secondary"}`}>
            {klass.name} · {prov.title}
          </div>
          <h1 className={`mt-1 text-2xl font-semibold tracking-tight text-ink`}>{result.studentName}</h1>
        </div>
        <ScoreBadge total={total} max={max} isDark={isDark} />
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Vänster: skannat original */}
        <ScanPanel
          pages={result.scanPages || []}
          isDark={isDark}
        />

        {/* Höger: AI-annotationer per steg */}
        <div className="space-y-3">
          {result.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              resultId={result.id}
              isDark={isDark}
            />
          ))}
          <ClassParamsSummary klass={klass} prov={prov} isDark={isDark} />
        </div>
      </div>
      </div>
    </>
  );
}

function ScoreBadge({ total, max, isDark }: { total: number; max: number; isDark: boolean }) {
  const pct = max ? total / max : 0;
  const scoreColor = isDark
    ? pct >= 0.85 ? "text-state-success"
      : pct >= 0.5 ? "text-state-warning"
      : "text-rose-400"
    : pct >= 0.85 ? "text-state-success"
      : pct >= 0.5 ? "text-state-warning"
      : "text-rose-700";
  return (
    <div className={`rounded-2xl border border-ink-hairline shadow-card px-5 py-3 bg-paper-elevated text-ink`}>
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">Slutpoäng</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${scoreColor}`}>
        {total}<span className={`text-base text-ink-muted`}> / {max}</span>
      </div>
    </div>
  );
}

function ScanPanel({
  pages,
  isDark,
}: {
  pages: string[];
  isDark: boolean;
}) {
  const totalPages = pages.length;
  return (
    <div className={`rounded-[24px] overflow-hidden shadow-lg shadow-ink/5 ${isDark ? "bg-ink/[0.03]" : "bg-paper-raised"}`}>
      <div className={`px-5 py-3 flex items-center justify-between ${isDark ? "bg-ink/[0.02]" : "bg-paper-secondary/50"}`}>
        <div className={`text-xs font-medium uppercase tracking-wider ${"text-ink-secondary"}`}>Originaldokument · skannat</div>
        <div className={`text-xs ${"text-ink-muted"}`}>{totalPages} sida{totalPages !== 1 ? "or" : ""}</div>
      </div>
      <div className={`p-4 space-y-4 ${isDark ? "" : "bg-[radial-gradient(circle_at_50%_0%,rgb(var(--accent) / 0.04),transparent_60%)]"}`}>
        {pages.length === 0 ? (
          <div className="rounded-2xl border border-state-warning/30 bg-state-warning/10 p-6 text-sm text-ink-secondary">
            Originaldokumentet saknas. Resultatet måste granskas mot den ursprungliga filen.
          </div>
        ) : (
          pages.map((src, i) => {
            if (src.startsWith("data:image")) {
              return (
                <div key={i} className="relative rounded-2xl overflow-hidden shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Sida ${i + 1}`} className="w-full" />
                  <div className="absolute top-2 right-2 text-[10px] font-mono bg-ink/80 text-paper px-2 py-0.5 rounded">
                    sida {i + 1}
                  </div>
                </div>
              );
            }
            if (src.startsWith("data:application/pdf")) {
              return (
                <object
                  key={i}
                  data={src}
                  type="application/pdf"
                  aria-label={`Originaldokument sida ${i + 1}`}
                  className="h-[70vh] w-full rounded-2xl bg-paper-raised shadow-md"
                >
                  <a href={src} download={`original-sida-${i + 1}.pdf`} className="text-sm underline">
                    Öppna originalets PDF-sida
                  </a>
                </object>
              );
            }
            return (
              <div key={i} className="rounded-2xl border border-state-danger/30 bg-state-danger/10 p-6 text-sm text-state-danger">
                Originalformatet kan inte visas. Ladda ner eller öppna källfilen separat.
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StepCard({
  step,
  resultId,
  isDark,
}: {
  step: Step;
  resultId: string;
  isDark: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const status = step.status;
  const ringMap: Record<Step["status"], string> = isDark
    ? {
        correct: "ring-state-success/30 bg-state-success/10",
        partial: "ring-state-warning/30 bg-state-warning/10",
        incorrect: "ring-rose-500/30 bg-rose-500/10",
        needs_review: "ring-state-warning/30 bg-amber-500/10",
        pending: "ring-paper-raised/10",
      }
    : {
        correct: "ring-state-success/30 bg-state-success/10/30",
        partial: "ring-state-warning/30 bg-state-warning/10/40",
        incorrect: "ring-rose-300 bg-rose-50/40",
        needs_review: "ring-amber-300 bg-amber-50/40",
        pending: "ring-ink-hairline",
      };

  const verdictColor = isDark
    ? status === "correct"
      ? "text-state-success"
      : status === "partial"
      ? "text-state-warning"
      : status === "incorrect"
      ? "text-rose-400"
      : status === "needs_review"
      ? "text-amber-300"
      : "text-paper/50"
    : status === "correct"
    ? "text-state-success"
    : status === "partial"
    ? "text-state-warning"
    : status === "incorrect"
    ? "text-rose-700"
    : status === "needs_review"
    ? "text-amber-600"
    : "text-ink-secondary";

  const reason = reviewReason(step);
  const annotation = step.annotation;
  const hasAnnotation = !!(
    annotation?.summary ||
    annotation?.evidence?.length ||
    annotation?.issues?.length ||
    annotation?.suggestions?.length
  );

  const approve = () => {
    actions.updateStep(resultId, step.id, { status: "correct" });
  };

  const redo = () => {
    // Läraren ökar poängen ett steg. Inga AI-texter läggs till.
    actions.updateStep(resultId, step.id, { status: "pending" });
    setTimeout(() => {
      const newPoints = Math.min(step.maxPoints, step.earnedPoints + 1);
      const newStatus: Step["status"] =
        newPoints === step.maxPoints ? "correct" : step.earnedPoints === 0 ? "incorrect" : "partial";
      actions.updateStep(resultId, step.id, {
        status: newStatus,
        earnedPoints: newPoints,
        feedback: step.feedback
          ? `${step.feedback} [Omvärderat av läraren: poäng ändrad till ${newPoints} / ${step.maxPoints}.]`
          : `Omvärderat av läraren: poäng ändrad till ${newPoints} / ${step.maxPoints}.`,
      });
    }, 1200);
  };

  return (
    <div
      className={`rounded-2xl ring-1 ${ringMap[status]} p-5 transition-all ${
        isDark ? "bg-paper-raised/5" : "bg-paper-raised"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className={`text-[11px] uppercase tracking-wider font-semibold ${
              "text-ink-muted"
            }`}
          >
            {step.label}
          </div>
          <div className={`mt-1 text-sm font-medium ${verdictColor}`}>
            <span className="inline-flex items-center gap-1.5">
              {status === "correct" && (
                <LineIcon name="check" className="h-3.5 w-3.5" />
              )}
              {status === "correct"
                ? "Korrekt"
                : status === "partial"
                ? "Delvis korrekt"
                : status === "incorrect"
                ? "Inkorrekt"
                : status === "needs_review"
                ? "Behöver granskas"
                : "Väntande"}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-xs uppercase tracking-wider ${
              "text-ink-muted"
            }`}
          >
            Poäng
          </div>
          <div
            className={`font-mono text-lg font-semibold tabular-nums ${
              isDark ? "text-paper" : "text-ink"
            }`}
          >
            {step.earnedPoints}
            <span
              className={
                isDark ? "text-paper/30" : "text-ink-muted"
              }
            >
              /{step.maxPoints}
            </span>
          </div>
        </div>
      </div>

      {/* Elevens svar */}
      <div
        className={`mt-3 rounded-xl p-3 text-xs leading-relaxed font-mono ${
          isDark
            ? "bg-paper-raised/[0.08] text-ink"
            : "bg-paper-secondary/70 text-ink"
        }`}
      >
        <span
          className={
            isDark ? "text-ink-secondary" : "text-ink-muted"
          }
        >
          Elev:
        </span>{" "}
        {step.studentWork ? (
          <span className="whitespace-pre-wrap">{step.studentWork}</span>
        ) : (
          <span
            className={
              isDark ? "text-paper/30 italic" : "text-ink-muted italic"
            }
          >
            {step.found === false
              ? "Uppgiften hittades inte i dokumentet."
              : "Eleven lämnade uppgiften obesvarad."}
          </span>
        )}
      </div>

      {/* Varför uppgiften behöver granskas – visas bara när det faktiskt gäller */}
      {reason && (
        <div
          className={`mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed ${
            isDark
              ? "bg-amber-400/10 ring-amber-400/25 text-amber-200"
              : "bg-amber-50 ring-amber-200/70 text-amber-900"
          }`}
        >
          <span className="font-semibold mr-1">Behöver granskas:</span>
          {reason}
        </div>
      )}

      {/* AI-annotation – strukturerad data från backend, aldrig genererad här */}
      {hasAnnotation && (
        <div
          className={`mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed ${
            isDark
              ? "bg-ink/5 ring-ink/15 text-ink"
              : "bg-ink/5 ring-ink/15 text-ink"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 font-semibold mb-1 align-[-2px] ${
              "text-ink"
            }`}
          >
            <LineIcon name="pen" className="h-3.5 w-3.5" />
            AI-annotation
          </span>

          {annotation?.summary && <p className="mt-1">{annotation.summary}</p>}

          {annotation?.evidence?.length ? (
            <ul className="mt-1.5 space-y-0.5">
              {annotation.evidence.map((item, i) => (
                <li key={`ev-${i}`} className="flex gap-1.5">
                  <span className={"text-state-success"}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.issues?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.issues.map((item, i) => (
                <li key={`is-${i}`} className="flex gap-1.5">
                  <span className={"text-state-danger"}>✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.suggestions?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.suggestions.map((item, i) => (
                <li key={`sg-${i}`} className="flex gap-1.5">
                  <span className={"text-state-warning"}>→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {step.mathVerification && step.mathVerification.status !== "not_applicable" && (
        <div className="mt-2 rounded-xl border border-ink-hairline bg-paper-secondary/50 p-3 text-xs leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">Matematisk verifiering:</span>{" "}
          {step.mathVerification.message}
          <span className="ml-2 text-ink-muted">
            {step.mathVerification.provider === "wolfram" ? "Wolfram" : "Lokal kontroll"}
            {step.mathVerification.confidence > 0
              ? ` · ${Math.round(step.mathVerification.confidence * 100)}%`
              : ""}
          </span>
        </div>
      )}

      {/* Feedback till eleven */}
      {step.feedback && (
        <div
          className={`mt-2 rounded-xl p-3 text-xs leading-relaxed ${
            isDark ? "bg-paper-raised/[0.08] text-ink" : "bg-paper-secondary/70 text-ink"
          }`}
        >
          <span className="font-semibold mr-1">Feedback:</span>
          {step.feedback}
        </div>
      )}

      {editing && (
        <EditStep
          step={step}
          resultId={resultId}
          onDone={() => setEditing(false)}
          isDark={isDark}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionBtn
          variant="primary"
          onClick={approve}
          isDark={isDark}
        >
          Godkänn
        </ActionBtn>
        <ActionBtn
          variant="secondary"
          onClick={() => setEditing(true)}
          isDark={isDark}
        >
          Anpassa
        </ActionBtn>
        <ActionBtn
          variant="ghost"
          onClick={redo}
          isDark={isDark}
        >
          Gör om
        </ActionBtn>
      </div>
    </div>
  );
}

function EditStep({
  step, resultId, onDone, isDark,
}: {
  step: Step;
  resultId: string;
  onDone: () => void;
  isDark: boolean;
}) {
  const [pts, setPts] = useState(step.earnedPoints);

  return (
    <div className={`mt-4 rounded-xl p-4 space-y-3 ${isDark ? "bg-paper-raised/[0.03]" : "bg-paper-secondary"}`}>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${"text-ink-secondary"}`}>Poäng:</span>
        <input
          type="number"
          step={0.25}
          min={0}
          max={step.maxPoints}
          value={pts}
          onChange={(e) => setPts(Number(e.target.value))}
          className={`w-24 py-1.5 text-sm rounded-lg border px-3 ${"bg-paper-raised/5 border-paper-raised/10 text-ink"}`}
        />
        <span className={`text-xs ${"text-ink-muted"}`}>/ {step.maxPoints}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className={`text-xs px-2 ${isDark ? "text-paper/50 hover:text-paper" : "text-ink-secondary hover:text-ink"}`}>Avbryt</button>
        <button
          onClick={() => {
            actions.updateStep(resultId, step.id, {
              earnedPoints: pts,
            });
            onDone();
          }}
          className="rounded-xl bg-ink text-paper text-xs font-semibold px-4 py-1.5 hover:bg-ink/90"
        >
          Spara ändring
        </button>
      </div>
    </div>
  );
}

function ActionBtn({
  variant, children, onClick, disabled, isDark,
}: {
  variant: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  const cls = isDark ? {
    primary: "bg-paper-raised text-ink hover:bg-paper-raised/90 disabled:bg-state-success disabled:text-paper disabled:opacity-90",
    secondary: "bg-paper-raised/10 ring-1 ring-paper-raised/20 text-paper hover:bg-paper-raised/20",
    ghost: "text-paper/50 hover:text-paper hover:bg-paper-raised/10",
  }[variant] : {
    primary: "bg-ink text-paper hover:bg-paper-secondary disabled:bg-state-success disabled:opacity-90",
    secondary: "bg-paper-raised ring-1 ring-ink-hairline text-ink hover:bg-paper-secondary",
    ghost: "text-ink-secondary hover:text-ink hover:bg-paper-secondary",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${cls}`}
    >
      {children}
    </button>
  );
}

function ClassParamsSummary({ klass, prov, isDark }: { klass: Klass; prov: Prov; isDark: boolean }) {
  const hasCustomRules = klass.gradingParams?.customRules?.length > 0;
  if (!hasCustomRules && !prov.customParams) return null;
  
  return (
    <div className={`rounded-2xl border border-dashed p-4 text-xs leading-relaxed ${isDark ? "border-paper-raised/10 bg-paper-raised/[0.02] text-ink-secondary" : "border-ink-hairline bg-paper-secondary/40 text-ink-secondary"}`}>
      <div className={`font-medium mb-2 ${isDark ? "text-paper" : "text-ink"}`}>Rättningsparametrar</div>
      {hasCustomRules && (
        <div className="mb-1">
          <span className={"text-ink-muted"}>Klassregler:</span>
          <ul className="mt-1 space-y-1 pl-3">
            {klass.gradingParams.customRules.map((rule, i) => (
              <li key={i} className="italic">· {rule}</li>
            ))}
          </ul>
        </div>
      )}
      {prov.customParams && (
        <div><span className={"text-ink-muted"}>Provet:</span> <span className="italic">{prov.customParams}</span></div>
      )}
    </div>
  );
}
