"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { AnswerKeyItem } from "@/lib/api";
import { actions, runBatchGrade, type GradingParams, type StudentResult } from "@/lib/store";

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

    return () => {
      abortRef.current?.abort();
    };
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
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="relative rounded-[32px] bg-white/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/30 ring-1 ring-white/50">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-fuchsia-400/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative px-10 pt-10 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  phase === "error" ? "bg-rose-500" : phase === "complete" ? "bg-emerald-500" : "bg-emerald-500 animate-pulse"
                }`} />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {phase === "error"
                    ? "Kontakt med backend misslyckades"
                    : "wiseOS rättar hela klassen"}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{provTitle}</h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                <span>{files.length} fil{files.length !== 1 ? "er" : ""}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>
                  {completedCount} / {expectedStudents || files.length} klara
                </span>
                {phase !== "idle" && phase !== "complete" && phase !== "error" && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-wise-600 font-medium">{PHASE_LABEL[phase]}</span>
                  </>
                )}
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
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
                      : "bg-gradient-to-r from-violet-500 to-purple-500"
                  }`}
                />
              </div>
            </div>

            {/* Pipeline visualization */}
            <div className="relative px-10 py-6 border-b border-slate-100">
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
                    label: integrations.groq ? "Groq AI" : integrations.anthropic ? "Claude AI" : "Generativ AI",
                    desc: "Genererar feedback",
                    live: Boolean(integrations.groq || integrations.anthropic),
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
                              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                              : "bg-slate-100 text-slate-400"
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
                        <div className="mt-2 text-sm font-semibold text-slate-900">{step.label}</div>
                        <div className="text-xs text-slate-500">{step.desc}</div>
                        {phase !== "idle" && phase !== "error" && (
                          <div className={`mt-1 text-[10px] uppercase tracking-wider font-semibold ${
                            step.live ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            {step.live ? "LIVE API" : "mock fallback"}
                          </div>
                        )}
                      </div>
                      {i < 2 && (
                        <div className="w-20 h-0.5 mx-4 rounded-full bg-slate-200 relative overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: done ? 1 : 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 origin-left"
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
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-sm text-rose-800">
                  <div className="font-semibold">Backend-fel</div>
                  <div className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</div>
                  <div className="mt-2 text-xs text-rose-700">
                    Kontrollera att API-tjänsten körs på {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"} och försök igen.
                  </div>
                </div>
              )}

              {phase !== "error" && results.length === 0 && (
                <div className="text-sm text-slate-500">
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
                      className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold bg-emerald-500 text-white">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{r.studentName}</div>
                          <div className="text-xs text-slate-500">
                            {r.totalScore.toFixed(1)} / {r.maxScore.toFixed(0)} poäng · {r.steps.length} uppgifter
                          </div>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          r.percentage >= 70
                            ? "bg-emerald-100 text-emerald-700"
                            : r.percentage >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
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
                  className="border-t border-slate-100"
                >
                  <div className="px-10 py-8">
                    <div className="flex items-center justify-between gap-6 flex-wrap">
                      {phase === "complete" && (
                        <div className="flex items-center gap-8">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                              Elever rättade
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-slate-900">
                              {completedCount}
                              <span className="text-slate-300">/{expectedStudents || files.length}</span>
                            </div>
                          </div>
                          <div className="h-12 w-px bg-slate-200" />
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                              Klassmedel
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-emerald-600">
                              {percent}%
                            </div>
                          </div>
                          <div className="h-12 w-px bg-slate-200" />
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                              Total tid
                            </div>
                            <div className="text-4xl font-semibold tracking-tight text-slate-900">
                              {analysisTime}
                              <span className="text-lg text-slate-400 ml-1">sek</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={onClose}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Stäng
                        </button>
                        {phase === "complete" && (
                          <button
                            onClick={() => onComplete(results)}
                            className="px-6 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 shadow-lg shadow-slate-900/20 transition-all"
                          >
                            Granska resultat
                          </button>
                        )}
                      </div>
                    </div>

                    {phase === "complete" && activeRules.length > 0 && (
                      <div className="mt-6 text-xs text-slate-500">
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
