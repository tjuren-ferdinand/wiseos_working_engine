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

// Generera en snygg AI-annotation för demon.
// I riktig drift skulle detta komma direkt från Claude + Wolfram.
function getAnnotation(step: Step): string {
  if (step.feedback && step.feedback.trim().length > 0) return step.feedback;

  switch (step.status) {
    case "correct":
      return "Claude: Lösningen är fullständigt korrekt och följer facit. Wolfram bekräftar värdet och inga av klassens regler ger avdrag.";
    case "partial":
      return "Claude: Delvis korrekt. Eleven har rätt idé men missar ett mellanled eller enheten. Klassreglerna ger delpoäng, inte full utdelning.";
    case "incorrect":
      return "Claude: Lösningen leder inte till rätt svar. Resonemanget avviker från facit och Wolfram får ett annat resultat.";
    case "pending":
    default:
      return "Claude: Ingen sparad analys för detta steg i demon, men här skulle en detaljerad AI-kommentar om elevens resonemang visas.";
  }
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
          <button onClick={onBack} className={`text-sm transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>← Tillbaka till klassmapp</button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPipeline(true)}
              className="group relative rounded-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:scale-[1.02]"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rätta om
              </span>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-20 blur transition-opacity" />
            </button>
            <button
              onClick={onPrint}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${isDark ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              Skriv ut genomgång + Original-PDF
            </button>
          </div>
        </div>

      <header className={`rounded-2xl border p-6 flex flex-wrap items-center justify-between gap-4 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white shadow-sm"}`}>
        <div>
          <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${isDark ? "text-white/40" : "text-slate-400"}`}>
            {klass.name} · {prov.title}
          </div>
          <h1 className={`mt-1 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>{result.studentName}</h1>
        </div>
        <ScoreBadge total={total} max={max} isDark={isDark} />
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Vänster: skannat original */}
        <ScanPanel
          pages={[]}
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
    ? pct >= 0.85 ? "text-emerald-400 bg-emerald-500/20 ring-emerald-500/30"
      : pct >= 0.5 ? "text-amber-400 bg-amber-500/20 ring-amber-500/30"
      : "text-rose-400 bg-rose-500/20 ring-rose-500/30"
    : pct >= 0.85 ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : pct >= 0.5 ? "text-amber-700 bg-amber-50 ring-amber-200"
      : "text-rose-700 bg-rose-50 ring-rose-200";
  return (
    <div className={`rounded-2xl ring-1 px-5 py-3 ${color}`}>
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold opacity-70">Slutpoäng</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">
        {total}<span className={`text-base ${isDark ? "text-white/30" : "text-slate-400"}`}> / {max}</span>
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
    <div className={`rounded-2xl border overflow-hidden ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white shadow-sm"}`}>
      <div className={`px-5 py-3 border-b flex items-center justify-between ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"}`}>
        <div className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/60" : "text-slate-600"}`}>Originaldokument · skannat</div>
        <div className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>{totalPages} sida{totalPages !== 1 ? "or" : ""}</div>
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
              <div key={i} className={`relative rounded-xl overflow-hidden ring-1 ${isDark ? "ring-white/10 bg-white/5" : "ring-slate-200 bg-white"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Sida ${i + 1}`} className="w-full" />
                <div className="absolute top-2 right-2 text-[10px] font-mono bg-slate-900/80 text-white px-2 py-0.5 rounded">
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
      className={`relative rounded-xl ring-1 p-6 overflow-hidden ${
        isDark ? "ring-white/10 bg-white/[0.03] text-white/80" : "ring-slate-200 bg-[#fdfcf8] text-slate-800 shadow-inner"
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
        <div className={`flex items-center justify-between text-[10px] uppercase tracking-widest font-sans ${isDark ? "text-white/40" : "text-slate-400"}`}>
          <span>Sida {pageIndex + 1} av {totalPages}</span>
          <span>SKANNAT · 300 DPI</span>
        </div>
        <pre
          className={`mt-3 whitespace-pre-wrap text-[19px] leading-[28px] tracking-wide ${
            isDark ? "text-white/85" : "text-slate-800"
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
    <div className={`relative rounded-xl ring-1 p-6 font-serif overflow-hidden ${isDark ? "ring-white/10 bg-white/[0.03] text-white/80" : "ring-slate-200 bg-[#fdfcf8] text-slate-700 shadow-inner"}`} style={{ fontFamily: "'Caveat', cursive, serif" }}>
      <div className={`absolute inset-0 opacity-[0.02] bg-[linear-gradient(transparent_23px,#94a3b8_24px)] bg-[size:100%_24px]`} />
      <div className="relative">
        <div className={`text-[10px] uppercase tracking-widest font-sans ${isDark ? "text-white/40" : "text-slate-400"}`}>Elev</div>
        <div className="text-xl italic mt-1" style={{ fontFamily: "'Caveat', cursive" }}>{studentName}</div>
        <hr className={`my-3 ${isDark ? "border-white/10" : "border-slate-300"}`} />
        <div className="space-y-4 text-base leading-relaxed">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`pb-3 border-b last:border-0 ${
                isDark ? "border-white/10" : "border-slate-100"
              }`}
            >
              <div
                className={`text-sm font-sans mb-1 ${
                  isDark ? "text-white/50" : "text-slate-500"
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
                        ? "text-white/20 italic"
                        : "text-slate-300 italic"
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
      <div className={`absolute bottom-2 right-3 text-[8px] font-mono font-sans ${isDark ? "text-white/20" : "text-slate-300"}`}>SKANNAT · 300 DPI</div>
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
        correct: "ring-emerald-500/30 bg-emerald-500/10",
        partial: "ring-amber-500/30 bg-amber-500/10",
        incorrect: "ring-rose-500/30 bg-rose-500/10",
        pending: "ring-white/10",
      }
    : {
        correct: "ring-emerald-300 bg-emerald-50/30",
        partial: "ring-amber-300 bg-amber-50/40",
        incorrect: "ring-rose-300 bg-rose-50/40",
        pending: "ring-slate-200",
      };

  const verdictColor = isDark
    ? status === "correct"
      ? "text-emerald-400"
      : status === "partial"
      ? "text-amber-400"
      : status === "incorrect"
      ? "text-rose-400"
      : "text-white/50"
    : status === "correct"
    ? "text-emerald-700"
    : status === "partial"
    ? "text-amber-700"
    : status === "incorrect"
    ? "text-rose-700"
    : "text-slate-500";

  const annotation = getAnnotation(step);

  const approve = () => {
    actions.updateStep(resultId, step.id, { status: "correct" });
  };

  const redo = () => {
    // Simulerad omvärdering: sätt pending, justera poäng och feedback.
    actions.updateStep(resultId, step.id, { status: "pending" });
    setTimeout(() => {
      const newPoints = Math.min(step.maxPoints, step.earnedPoints + 1);
      actions.updateStep(resultId, step.id, {
        status: newPoints === step.maxPoints ? "correct" : "partial",
        earnedPoints: newPoints,
        feedback:
          annotation +
          " · Omvärderat: Claude har hittat ytterligare delvis korrekta resonemang och föreslår justerade poäng.",
      });
    }, 1200);
  };

  return (
    <div
      className={`rounded-2xl ring-1 ${ringMap[status]} p-5 transition-all ${
        isDark ? "bg-white/5" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className={`text-[11px] uppercase tracking-wider font-semibold ${
              isDark ? "text-white/40" : "text-slate-400"
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
                : "Väntande"}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-xs uppercase tracking-wider ${
              isDark ? "text-white/40" : "text-slate-400"
            }`}
          >
            Poäng
          </div>
          <div
            className={`font-mono text-lg font-semibold tabular-nums ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {step.earnedPoints}
            <span
              className={
                isDark ? "text-white/30" : "text-slate-400"
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
            ? "bg-white/[0.03] text-white/70"
            : "bg-slate-50/70 text-slate-700"
        }`}
      >
        <span
          className={
            isDark ? "text-white/40" : "text-slate-400"
          }
        >
          Elev:
        </span>{" "}
        {step.studentWork ? (
          <span>{step.studentWork}</span>
        ) : (
          <span
            className={
              isDark ? "text-white/30 italic" : "text-slate-400 italic"
            }
          >
            Elevens lösning är inte inskannad i denna demo.
          </span>
        )}
      </div>

      {/* AI-annotation från "Claude" */}
      <div
        className={`mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed ${
          isDark
            ? "bg-[#e8b0e4]/10 ring-[#e8b0e4]/20 text-[#e8b0e4]"
            : "bg-rose-50/40 ring-rose-100/60 text-rose-900"
        }`}
      >
        <span
          className={`inline-flex items-center gap-1 font-semibold mr-1 align-[-2px] ${
            isDark ? "text-[#e8b0e4]" : "text-rose-500"
          }`}
        >
          <LineIcon name="pen" className="h-3.5 w-3.5" />
          AI-annotation:
        </span>
        <span className="italic">{annotation}</span>
      </div>

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
    <div className={`mt-4 rounded-xl p-4 space-y-3 ${isDark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${isDark ? "text-white/60" : "text-slate-600"}`}>Poäng:</span>
        <input
          type="number"
          step={0.25}
          min={0}
          max={step.maxPoints}
          value={pts}
          onChange={(e) => setPts(Number(e.target.value))}
          className={`w-24 py-1.5 text-sm rounded-lg border px-3 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"}`}
        />
        <span className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>/ {step.maxPoints}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className={`text-xs px-2 ${isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>Avbryt</button>
        <button
          onClick={() => {
            actions.updateStep(resultId, step.id, {
              earnedPoints: pts,
            });
            onDone();
          }}
          className="rounded-full bg-[#e8b0e4] text-slate-900 text-xs font-semibold px-4 py-1.5 hover:bg-[#d89dd3]"
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
    primary: "bg-white text-slate-900 hover:bg-white/90 disabled:bg-emerald-500 disabled:text-white disabled:opacity-90",
    secondary: "bg-white/10 ring-1 ring-white/20 text-white hover:bg-white/20",
    ghost: "text-white/50 hover:text-white hover:bg-white/10",
  }[variant] : {
    primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-emerald-600 disabled:opacity-90",
    secondary: "bg-white ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
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
    <div className={`rounded-2xl border border-dashed p-4 text-xs leading-relaxed ${isDark ? "border-white/10 bg-white/[0.02] text-white/60" : "border-slate-200 bg-slate-50/40 text-slate-600"}`}>
      <div className={`font-medium mb-2 ${isDark ? "text-white" : "text-slate-800"}`}>Rättningsparametrar</div>
      {hasCustomRules && (
        <div className="mb-1">
          <span className={isDark ? "text-white/40" : "text-slate-400"}>Klassregler:</span>
          <ul className="mt-1 space-y-1 pl-3">
            {klass.gradingParams.customRules.map((rule, i) => (
              <li key={i} className="italic">· {rule}</li>
            ))}
          </ul>
        </div>
      )}
      {prov.customParams && (
        <div><span className={isDark ? "text-white/40" : "text-slate-400"}>Provet:</span> <span className="italic">{prov.customParams}</span></div>
      )}
    </div>
  );
}
