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
import GradingPipeline from "./GradingPipeline";

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
  const [showPipeline, setShowPipeline] = useState(false);
  
  // Beräkna total från V2 Step structure
  const total = result.steps.reduce((s, st) => s + st.earnedPoints, 0);
  const max = result.steps.reduce((s, st) => s + st.maxPoints, 0);

  return (
    <>
      <GradingPipeline
        open={showPipeline}
        onClose={() => setShowPipeline(false)}
        onComplete={() => setShowPipeline(false)}
        studentName={result.studentName}
        provTitle={prov.title}
        questionCount={result.steps.length}
      />
      
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className={`text-sm transition-colors ${isDark ? "text-paper/50 hover:text-paper" : "text-ink-secondary hover:text-ink"}`}>← Tillbaka till klassmapp</button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPipeline(true)}
              className="group relative rounded-full px-4 py-2 text-sm font-semibold text-paper bg-gradient-to-r from-ink to-ink hover:from-ink/80 hover:to-ink/60 shadow-lg shadow-ink/[0.10] transition-all hover:shadow-card hover:shadow-ink/[0.10] hover:scale-[1.02]"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rätta om
              </span>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-ink/80 to-ink/60 opacity-0 group-hover:opacity-20 blur transition-opacity" />
            </button>
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
          <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${isDark ? "text-ink-muted" : "text-ink-muted"}`}>
            {klass.name} · {prov.title}
          </div>
          <h1 className={`mt-1 text-2xl font-semibold tracking-tight ${isDark ? "text-paper" : "text-ink"}`}>{result.studentName}</h1>
        </div>
        <ScoreBadge total={total} max={max} isDark={isDark} />
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Vänster: skannat original */}
        <ScanPanel
          pages={result.scanPages || []}
          mockPages={result.mockScanPages}
          studentName={result.studentName}
          steps={result.steps}
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
  const color = isDark
    ? pct >= 0.85 ? "text-state-success bg-state-success/20 ring-state-success/30"
      : pct >= 0.5 ? "text-state-warning bg-state-warning/20 ring-state-warning/30"
      : "text-rose-400 bg-rose-500/20 ring-rose-500/30"
    : pct >= 0.85 ? "text-state-success bg-state-success/10 ring-state-success/20"
      : pct >= 0.5 ? "text-state-warning bg-state-warning/10 ring-state-warning/20"
      : "text-rose-700 bg-rose-50 ring-rose-200";
  return (
    <div className={`rounded-2xl ring-1 px-5 py-3 ${color}`}>
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold opacity-70">Slutpoäng</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">
        {total}<span className={`text-base ${isDark ? "text-paper/30" : "text-ink-muted"}`}> / {max}</span>
      </div>
    </div>
  );
}

function ScanPanel({
  pages,
  mockPages,
  studentName,
  steps,
  isDark,
}: {
  pages: string[];
  mockPages?: string[];
  studentName: string;
  steps: Step[];
  isDark: boolean;
}) {
  const totalPages = mockPages && mockPages.length > 0 ? mockPages.length : pages.length > 0 ? pages.length : 1;
  return (
    <div className={`rounded-[24px] overflow-hidden shadow-lg shadow-ink/5 ${isDark ? "bg-ink/[0.03]" : "bg-paper-raised"}`}>
      <div className={`px-5 py-3 flex items-center justify-between ${isDark ? "bg-ink/[0.02]" : "bg-paper-secondary/50"}`}>
        <div className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-ink-secondary" : "text-ink-secondary"}`}>Originaldokument · skannat</div>
        <div className={`text-xs ${isDark ? "text-ink-muted" : "text-ink-secondary"}`}>{totalPages} sida{totalPages !== 1 ? "or" : ""}</div>
      </div>
      <div className={`p-4 space-y-4 ${isDark ? "" : "bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.04),transparent_60%)]"}`}>
        {mockPages && mockPages.length > 0 ? (
          mockPages.map((text, i) => (
            <MockScanPage
              key={i}
              pageIndex={i}
              totalPages={mockPages.length}
              text={text}
              isDark={isDark}
            />
          ))
        ) : pages.length === 0 ? (
          <MockScan studentName={studentName} steps={steps} isDark={isDark} />
        ) : (
          pages.map((src, i) =>
            src.startsWith("data:image") ? (
              <div key={i} className="relative rounded-2xl overflow-hidden shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Sida ${i + 1}`} className="w-full" />
                <div className="absolute top-2 right-2 text-[10px] font-mono bg-ink/80 text-paper px-2 py-0.5 rounded">
                  sida {i + 1}
                </div>
              </div>
            ) : (
              <MockScan key={i} studentName={studentName} steps={steps} isDark={isDark} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function MockScanPage({
  pageIndex,
  totalPages,
  text,
  isDark,
}: {
  pageIndex: number;
  totalPages: number;
  text: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 overflow-hidden shadow-md ${
        isDark ? "bg-ink/[0.03] text-ink" : "bg-[#fdfcf8] text-ink"
      }`}
    >
      {/* Handskrivna linjer bakom text */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none ${
          isDark ? "opacity-[0.04]" : "opacity-[0.08]"
        } bg-[linear-gradient(transparent_27px,#94a3b8_28px)] bg-[size:100%_28px]`}
      />
      {/* Sido-marginallinje som riktiga rutade block */}
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-10 w-px ${isDark ? "bg-rose-400/20" : "bg-rose-300/40"}`}
      />
      <div className="relative">
        <div className={`flex items-center justify-between text-[10px] uppercase tracking-widest font-sans ${isDark ? "text-ink-muted" : "text-ink-muted"}`}>
          <span>Sida {pageIndex + 1} av {totalPages}</span>
          <span>SKANNAT · 300 DPI</span>
        </div>
        <pre
          className={`mt-3 whitespace-pre-wrap text-[19px] leading-[28px] tracking-wide ${
            isDark ? "text-paper/85" : "text-ink"
          }`}
          style={{ fontFamily: "'Caveat', cursive", fontWeight: 500 }}
        >
{text}
        </pre>
      </div>
    </div>
  );
}

function MockScan({ studentName, steps, isDark }: { studentName: string; steps: Step[]; isDark: boolean }) {
  // Handskrivet-liknande elevsvar
  return (
    <div className={`relative rounded-2xl p-6 font-serif overflow-hidden shadow-md ${isDark ? "bg-ink/[0.03] text-ink" : "bg-[#fdfcf8] text-ink"}`} style={{ fontFamily: "'Caveat', cursive, serif" }}>
      <div className={`absolute inset-0 opacity-[0.02] bg-[linear-gradient(transparent_23px,#94a3b8_24px)] bg-[size:100%_24px]`} />
      <div className="relative">
        <div className={`text-[10px] uppercase tracking-widest font-sans ${isDark ? "text-ink-muted" : "text-ink-muted"}`}>Elev</div>
        <div className="text-xl italic mt-1" style={{ fontFamily: "'Caveat', cursive" }}>{studentName}</div>
        <hr className={`my-3 ${isDark ? "border-paper-raised/10" : "border-ink-hairline"}`} />
        <div className="space-y-4 text-base leading-relaxed">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`pb-3 border-b last:border-0 ${
                isDark ? "border-paper-raised/10" : "border-ink-hairline"
              }`}
            >
              <div
                className={`text-sm font-sans mb-1 ${
                  isDark ? "text-paper/50" : "text-ink-secondary"
                }`}
              >
                {step.label}
              </div>
              <div
                className="text-lg pl-2 whitespace-pre-wrap"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                {step.studentWork ? (
                  <span>{step.studentWork}</span>
                ) : (
                  <span
                    className={
                      isDark
                        ? "text-paper/20 italic"
                        : "text-ink-muted italic"
                    }
                  >
                    Elevens svar är inte inskannat i denna demo.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`absolute bottom-2 right-3 text-[8px] font-mono font-sans ${isDark ? "text-paper/20" : "text-ink-muted"}`}>SKANNAT · 300 DPI</div>
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
              isDark ? "text-ink-muted" : "text-ink-muted"
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
              isDark ? "text-ink-muted" : "text-ink-muted"
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
            ? "bg-paper-raised/[0.03] text-paper/70"
            : "bg-paper-secondary/70 text-ink"
        }`}
      >
        <span
          className={
            isDark ? "text-ink-muted" : "text-ink-muted"
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
              ? "bg-[#e8b0e4]/10 ring-[#e8b0e4]/20 text-[#e8b0e4]"
              : "bg-rose-50/40 ring-rose-100/60 text-rose-900"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 font-semibold mb-1 align-[-2px] ${
              isDark ? "text-[#e8b0e4]" : "text-rose-500"
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
                  <span className={isDark ? "text-emerald-300" : "text-emerald-600"}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.issues?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.issues.map((item, i) => (
                <li key={`is-${i}`} className="flex gap-1.5">
                  <span className={isDark ? "text-rose-300" : "text-rose-600"}>✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.suggestions?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.suggestions.map((item, i) => (
                <li key={`sg-${i}`} className="flex gap-1.5">
                  <span className={isDark ? "text-sky-300" : "text-sky-600"}>→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Feedback till eleven */}
      {step.feedback && (
        <div
          className={`mt-2 rounded-xl p-3 text-xs leading-relaxed ${
            isDark ? "bg-paper-raised/[0.03] text-paper/70" : "bg-paper-secondary/70 text-ink"
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
        <span className={`text-xs font-medium ${isDark ? "text-ink-secondary" : "text-ink-secondary"}`}>Poäng:</span>
        <input
          type="number"
          step={0.25}
          min={0}
          max={step.maxPoints}
          value={pts}
          onChange={(e) => setPts(Number(e.target.value))}
          className={`w-24 py-1.5 text-sm rounded-lg border px-3 ${isDark ? "bg-paper-raised/5 border-paper-raised/10 text-paper" : "bg-paper-raised border-ink-hairline text-ink"}`}
        />
        <span className={`text-xs ${isDark ? "text-ink-muted" : "text-ink-secondary"}`}>/ {step.maxPoints}</span>
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
          className="rounded-full bg-[#e8b0e4] text-ink text-xs font-semibold px-4 py-1.5 hover:bg-[#d89dd3]"
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
          <span className={isDark ? "text-ink-muted" : "text-ink-muted"}>Klassregler:</span>
          <ul className="mt-1 space-y-1 pl-3">
            {klass.gradingParams.customRules.map((rule, i) => (
              <li key={i} className="italic">· {rule}</li>
            ))}
          </ul>
        </div>
      )}
      {prov.customParams && (
        <div><span className={isDark ? "text-ink-muted" : "text-ink-muted"}>Provet:</span> <span className="italic">{prov.customParams}</span></div>
      )}
    </div>
  );
}
