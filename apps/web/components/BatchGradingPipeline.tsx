"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { AnswerKeyItem } from "@/lib/api";
import { actions, runBatchGrade, type GradingParams, type StudentResult } from "@/lib/store";
import { useTheme } from "@/lib/theme";

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
  gemini: "Gemini Vision OCR",
  openrouter: "OpenRouter Vision OCR",
  groq: "Groq Vision OCR",
  mock: "OCR (demo-läge)",
};

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  uploading: "Laddar upp och sektionerar",
  processing: "OCR + Wolfram + AI arbetar",
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

  const completedCount = results.length;
  const totalScore = results.reduce((s, r) => s + r.totalScore, 0);
  const totalMaxScore = results.reduce((s, r) => s + r.maxScore, 0);
  const percent = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-paper backdrop-blur-2xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative z-10 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className={`relative rounded-[32px] border backdrop-blur-2xl shadow-card ${
            isDark
              ? "bg-paper-elevated/95 border-ink-hairline shadow-ink/[0.12]"
              : "bg-paper-elevated/95 border-ink-hairline shadow-ink/[0.08]"
          }`}>
            <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl ${
              isDark ? "bg-gradient-to-br from-paper-raised/20 to-paper-raised/10" : "bg-gradient-to-br from-paper-secondary/30 to-paper-secondary/20"
            }`} />
            <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl ${
              isDark ? "bg-gradient-to-tr from-accent/10 to-accent/5" : "bg-gradient-to-tr from-blue-400/20 to-cyan-400/20"
            }`} />

            {/* Header */}
            <div className="relative px-10 pt-10 pb-6 border-b border-ink-hairline">
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  phase === "error" ? "bg-rose-500" : phase === "complete" ? "bg-state-success" : "bg-state-success animate-pulse"
                }`} />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-secondary">
                  {phase === "error"
                    ? "Kontakt med backend misslyckades"
                    : "wiseOS rättar hela klassen"}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{provTitle}</h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-ink-secondary">
                <span>{files.length} fil{files.length !== 1 ? "er" : ""}</span>
                <span className="h-1 w-1 rounded-full bg-paper-secondary" />
                <span>
                  {completedCount} / {expectedStudents || files.length} klara
                </span>
                {phase !== "idle" && phase !== "complete" && phase !== "error" && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-paper-secondary" />
                    <span className="text-ink-secondary font-medium">{PHASE_LABEL[phase]}</span>
                  </>
                )}
              </div>

              <div className="mt-4 h-2 rounded-full bg-paper-secondary overflow-hidden">
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
                    phase === "error"
                      ? "bg-rose-500"
                      : "bg-gradient-to-r from-ink to-paper-raised"
                  }`}
                />
              </div>
            </div>

            {/* Pipeline visualization */}
            <div className="relative px-10 py-6 border-b border-ink-hairline">
              <div className="flex items-center justify-between">
                {[
                  {
                    id: "mathpix",
                    label: OCR_LABELS[String(integrations.ocrProvider ?? "")] ?? "OCR",
                    desc: "Läser handskrift",
                    live: Boolean(integrations.ocr ?? integrations.mathpix),
                  },
                  { id: "wolfram", label: "Wolfram", desc: "Verifierar matematik", live: Boolean(integrations.wolfram) },
                  {
                    id: "generative-ai",
                    label: integrations.gemini ? "Gemini AI" : integrations.groq ? "Groq AI" : integrations.anthropic ? "Claude AI" : "Generativ AI",
                    desc: "Genererar feedback",
                    live: Boolean(integrations.gemini || integrations.groq || integrations.anthropic),
                  },
                ].map((step, i) => {
                  const done = phase === "complete";
                  const activeStage =
                    (step.id === "mathpix" && phase === "processing") ||
                    (step.id === "wolfram" && phase === "processing") ||
                    (step.id === "generative-ai" && phase === "saving");
                  return (
                    <div key={step.id} className="flex items-center">
                      <div className="text-center">
                        <div
                          className={`h-12 w-12 mx-auto rounded-2xl flex items-center justify-center transition-all ${
                            done || activeStage
                              ? "bg-gradient-to-br from-ink to-ink text-paper shadow-lg shadow-ink/[0.12]"
                              : "bg-paper-secondary text-ink-muted"
                          }`}
                        >
                          {done ? (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-lg font-bold">{i + 1}</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-ink">{step.label}</div>
                        <div className="text-xs text-ink-secondary">{step.desc}</div>
                        {phase !== "idle" && phase !== "error" && step.live && (
                          <div className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-state-success">
                            Live
                          </div>
                        )}
                      </div>
                      {i < 2 && (
                        <div className="w-20 h-0.5 mx-4 rounded-full bg-paper-secondary relative overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: done ? 1 : 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-gradient-to-r from-ink to-paper-raised origin-left"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="relative px-10 py-6 max-h-[30vh] overflow-y-auto">
              {phase === "error" && error && (
                <div className={`rounded-2xl border p-5 text-sm ${
                  isDark
                    ? "bg-rose-950/30 border-rose-500/20 text-rose-200"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <div className="font-semibold">Backend-fel</div>
                  <div className="mt-1 whitespace-pre-wrap font-mono text-xs opacity-90">{error}</div>
                  <div className="mt-2 text-xs opacity-80">
                    Kontrollera att API-tjänsten körs på {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"} och försök igen.
                  </div>
                </div>
              )}

              {phase !== "error" && results.length === 0 && (
                <div className="text-sm text-ink-secondary">
                  wiseOS analyserar {files.length} inskannade prov. Detta tar normalt 4–8 sekunder per elev.
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-state-success/10 ring-1 ring-state-success/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold bg-state-success text-paper">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-ink">{r.studentName}</div>
                          <div className="text-xs text-ink-secondary">
                            {r.totalScore.toFixed(1)} / {r.maxScore.toFixed(0)} poäng · {r.steps.length} uppgifter
                          </div>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
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
                  <div className="px-10 py-8">
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                      {phase === "complete" && (
                        <div className="flex items-center gap-8">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Elever rättade
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-ink">
                              {completedCount}
                              <span className="text-ink-muted">/{expectedStudents || files.length}</span>
                            </div>
                          </div>
                          <div className="h-12 w-px bg-paper-secondary" />
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Klassmedel
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-state-success">
                              {percent}%
                            </div>
                          </div>
                          <div className="h-12 w-px bg-paper-secondary" />
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                              Total tid
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-ink">
                              {analysisTime}
                              <span className="text-lg text-ink-muted ml-1">sek</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={onClose}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-ink-secondary bg-paper-secondary hover:bg-paper-secondary transition-colors"
                        >
                          Stäng
                        </button>
                        {phase === "complete" && (
                          <button
                            onClick={() => onComplete(results)}
                            className="px-6 py-3 rounded-2xl text-sm font-semibold text-paper bg-gradient-to-r from-ink to-paper-secondary hover:from-paper-secondary hover:to-paper-secondary hover:text-ink shadow-lg shadow-card transition-all"
                          >
                            Granska resultat
                          </button>
                        )}
                      </div>
                    </div>

                    {phase === "complete" && activeRules.length > 0 && (
                      <div className="mt-6 text-xs text-ink-secondary">
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
}
