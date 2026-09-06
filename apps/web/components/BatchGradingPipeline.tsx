"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

import type { AnswerKeyItem } from "@/lib/api";
import { actions, runBatchGrade, type GradingParams, type StudentResult } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

// ============================================================================
// TYPES
// ============================================================================

type Phase = "idle" | "uploading" | "processing" | "saving" | "complete" | "error";

interface BatchGradingPipelineProps {
  open: boolean;
  onClose: () => void;
  onComplete: (results: StudentResult[]) => void;
  provTitle: string;
  provId: string;
  klassId: string;
  klassParams: GradingParams;
  customParams: string;
  answerKey: AnswerKeyItem[];
  files: File[];
  identificationMethod: "name_field" | "qr_code" | "barcode" | "student_id";
  /** Antalet elever i klassen – används bara för att visa "N klara / total" i UI. */
  expectedStudents: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const OCR_LABELS: Record<string, string> = {
  mathpix: "Mathpix OCR",
  "gemini-vision": "Gemini Vision",
  gemini: "Gemini Vision",
  openrouter: "OpenRouter Vision",
  groq: "Groq Vision",
  unavailable: "Dokumentanalys ej konfigurerad",
};

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  uploading: "Laddar upp och sektionerar",
  processing: "Dokumentanalys och bedömning pågår",
  saving: "Sparar resultat",
  complete: "Klar",
  error: "Fel",
};

export default function BatchGradingPipeline({
  open,
  onClose,
  onComplete,
  provTitle,
  provId,
  klassId,
  klassParams,
  customParams,
  answerKey,
  files,
  identificationMethod,
  expectedStudents,
}: BatchGradingPipelineProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [activeRules, setActiveRules] = useState<string[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, boolean | string>>({});
  const [analysisTime, setAnalysisTime] = useState(0);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const runArgsRef = useRef({
    files,
    answerKey,
    klassParams,
    customParams,
    identificationMethod,
    provId,
    klassId,
  });
  runArgsRef.current = {
    files,
    answerKey,
    klassParams,
    customParams,
    identificationMethod,
    provId,
    klassId,
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      setPhase("idle");
      setError(null);
      setResults([]);
      return;
    }
    if (startedRef.current) return;

    const { files, answerKey, klassParams, customParams, identificationMethod, provId, klassId } = runArgsRef.current;
    if (files.length === 0) {
      actions.updateProvStatus(provId, "draft");
      setError("Ladda upp minst ett elevsvar innan rättningen startas.");
      setPhase("error");
      return;
    }
    startedRef.current = true;
    abortRef.current = new AbortController();

    const t0 = Date.now();
    (async () => {
      try {
        const out = await runBatchGrade({
          provId,
          klassId,
          klassParams,
          customParams,
          answerKey,
          files,
          identificationMethod,
          onPhase: (p) => setPhase(p),
          signal: abortRef.current?.signal,
        });
        setResults(out.added);
        setActiveRules(out.activeRules);
        setIntegrations(out.integrations);
        setAnalysisTime(Math.round((Date.now() - t0) / 1000));
        setPhase("complete");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
        setPhase("error");
      }
    })();

    // Ingen cleanup-abort här: `open` går till false innan unmount i alla
    // riktiga stängningsflöden (hanteras av !open-grenen ovan). En cleanup
    // som avbryter vid varje effect-körning skulle även avbryta det korrekta
    // anropet under React 18 Strict Modes avsiktliga mount→cleanup→mount i
    // dev, vilket gjorde att rättningen avbröts direkt vid start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const completedCount = results.length;
  const totalScore = results.reduce((s, r) => s + r.totalScore, 0);
  const totalMaxScore = results.reduce((s, r) => s + r.maxScore, 0);
  const percent = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="batch-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative z-10 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className={`rounded-[24px] border shadow-card ${
            isDark
              ? "bg-paper-elevated border-ink-hairline shadow-ink/[0.12]"
              : "bg-paper-elevated border-ink-hairline shadow-ink/[0.08]"
          }`}>
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-ink-hairline">
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  phase === "error" ? "bg-state-danger" : phase === "complete" ? "bg-state-success" : "bg-state-success animate-pulse"
                }`} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-secondary">
                  {phase === "error"
                    ? "Kontakt med backend misslyckades"
                    : "wiseOS rättar hela klassen"}
                </span>
              </div>
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">{provTitle}</h1>
              <div className="mt-2 flex items-center gap-4 text-[13px] text-ink-secondary">
                <span>{files.length} fil{files.length !== 1 ? "er" : ""}</span>
                <span className="h-1 w-1 rounded-full bg-ink-hairline" />
                <span>
                  {completedCount} / {expectedStudents || files.length} klara
                </span>
                {phase !== "idle" && phase !== "complete" && phase !== "error" && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-ink-hairline" />
                    <span className="font-medium text-ink">{PHASE_LABEL[phase]}</span>
                  </>
                )}
              </div>

              <div className="mt-5 h-2 rounded-full bg-paper-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      phase === "complete"
                        ? "100%"
                        : phase === "saving"
                        ? "85%"
                        : phase === "processing"
                        ? "55%"
                        : phase === "uploading"
                        ? "20%"
                        : phase === "error"
                        ? "100%"
                        : "5%",
                  }}
                  transition={{ type: "spring", damping: 30, stiffness: 60 }}
                  className={`h-full rounded-full ${
                    phase === "error" ? "bg-state-danger" : "bg-ink"
                  }`}
                />
              </div>
            </div>

            {/* Pipeline visualization */}
            <div className="px-8 py-7 border-b border-ink-hairline">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
                {[
                  {
                    id: "document-analysis",
                    label: OCR_LABELS[String(integrations.ocrProvider ?? "unavailable")] ?? "Dokumentanalys",
                    desc: "Läser och segmenterar svar",
                    live: integrations.ocrProvider !== "unavailable",
                  },
                  {
                    id: "math-verification",
                    label: integrations.mathVerificationProvider === "wolfram" ? "Wolfram" : "Lokal matematikkontroll",
                    desc: integrations.mathVerificationProvider === "wolfram" ? "Verifierar relevanta uttryck" : "Degraderat utvecklingsläge",
                    live: integrations.mathVerificationProvider === "wolfram",
                  },
                  {
                    id: "feedback",
                    label: integrations.feedbackProvider === "anthropic" ? "Claude feedback" : `${String(integrations.feedbackProvider ?? "Ingen")} feedback`,
                    desc: "Strukturerad återkoppling",
                    live: integrations.feedbackProvider !== "unavailable",
                  },
                ].map((step, i) => {
                  const done = phase === "complete";
                  const activeStage = phase === "processing";
                  const isActive = done || activeStage;
                  return (
                    <div key={step.id} className={`relative text-center px-2 py-4 rounded-2xl border transition-colors ${
                      isActive
                        ? "border-ink-hairline/20 bg-paper-raised"
                        : "border-transparent bg-transparent"
                    }`}>
                      <div
                        className={`h-11 w-11 mx-auto rounded-2xl flex items-center justify-center transition-all ${
                          isActive
                            ? "bg-ink text-paper"
                            : "bg-paper-secondary text-ink-muted"
                        }`}
                      >
                        {done ? (
                          <LineIcon name="check" className="h-5 w-5" />
                        ) : (
                          <span className="text-[15px] font-semibold">{i + 1}</span>
                        )}
                      </div>
                      <div className="mt-3 text-[13.5px] font-semibold text-ink">{step.label}</div>
                      <div className="text-[12px] text-ink-secondary mt-0.5">{step.desc}</div>
                      {phase !== "idle" && phase !== "error" && step.live && (
                        <div className="mt-1.5 text-[10px] uppercase tracking-wider font-semibold text-state-success">
                          Live
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-6 max-h-[26vh] overflow-y-auto">
              {phase === "error" && error && (
                <div className={`rounded-2xl border p-5 text-[13.5px] ${
                  isDark
                    ? "bg-state-danger/10 border-state-danger/20 text-state-danger"
                    : "bg-state-danger/10 border-state-danger/20 text-state-danger"
                }`}>
                  <div className="font-semibold">Backend-fel</div>
                  <div className="mt-1 whitespace-pre-wrap font-mono text-[12px] opacity-90">{error}</div>
                  <div className="mt-2 text-[12px] opacity-80">
                    Kontrollera att API-tjänsten körs på {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"} och försök igen.
                  </div>
                </div>
              )}

              {phase !== "error" && results.length === 0 && (
                <div className="text-[13.5px] text-ink-secondary leading-relaxed">
                  wiseOS analyserar {files.length} inskannade prov. Detta tar normalt 4–8 sekunder per elev.
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-state-success/[0.08] ring-1 ring-state-success/15"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-state-success text-paper">
                          <LineIcon name="check" className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-ink">{r.studentName}</div>
                          <div className="text-[12px] text-ink-secondary">
                            {r.totalScore.toFixed(1)} / {r.maxScore.toFixed(0)} poäng · {r.steps.length} uppgifter
                          </div>
                        </div>
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-full text-[12.5px] font-semibold ${
                          r.percentage >= 70
                            ? "bg-state-success/10 text-state-success"
                            : r.percentage >= 50
                            ? "bg-state-warning/10 text-state-warning"
                            : "bg-state-danger/10 text-state-danger"
                        }`}
                      >
                        {r.percentage}%
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / results */}
            <AnimatePresence>
              {(phase === "complete" || phase === "error") && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-ink-hairline"
                >
                  <div className="px-8 py-7">
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                      {phase === "complete" && (
                        <div className="flex items-center gap-6 sm:gap-8">
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Elever rättade
                            </div>
                            <div className="text-3xl font-semibold tracking-tight text-ink">
                              {completedCount}
                              <span className="text-ink-muted text-2xl">/{expectedStudents || files.length}</span>
                            </div>
                          </div>
                          <div className="h-10 w-px bg-paper-secondary" />
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Klassmedel
                            </div>
                            <div className="text-3xl font-semibold tracking-tight text-state-success">
                              {percent}%
                            </div>
                          </div>
                          <div className="h-10 w-px bg-paper-secondary" />
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Total tid
                            </div>
                            <div className="text-3xl font-semibold tracking-tight text-ink">
                              {analysisTime}
                              <span className="text-[15px] text-ink-muted ml-1">sek</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={onClose}
                          className="px-5 py-2.5 rounded-[10px] text-[13.5px] font-medium text-ink-secondary bg-paper-secondary hover:bg-paper transition-colors"
                        >
                          Stäng
                        </button>
                        {phase === "complete" && (
                          <button
                            onClick={() => onComplete(results)}
                            className="px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold text-paper bg-ink hover:bg-ink/90 transition-colors"
                          >
                            Granska resultat
                          </button>
                        )}
                      </div>
                    </div>

                    {phase === "complete" && activeRules.length > 0 && (
                      <div className="mt-5 text-[12px] text-ink-secondary">
                        Aktiva klassregler: {activeRules.join(", ")}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
