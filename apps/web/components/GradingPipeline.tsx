"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
const { fetchGradingResults } = api;

// ============================================================================
// TYPES
// ============================================================================

interface GradingPipelineProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  studentName: string;
  provTitle: string;
  questionCount: number;
}

type PipelineStage = "idle" | "mathpix" | "wolfram" | "claude" | "complete";

interface MathpixResult {
  questionNumber: number;
  original: string;
  converted: string;
}

interface WolframResult {
  questionNumber: number;
  studentAnswer: string;
  expectedAnswer: string;
  status: "correct" | "partial" | "incorrect" | "error";
  verification: string;
}

interface ClaudeFeedback {
  text: string;
  isComplete: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GradingPipeline({
  open,
  onClose,
  onComplete,
  studentName,
  provTitle,
  questionCount,
}: GradingPipelineProps) {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [mathpixProgress, setMathpixProgress] = useState(0);
  const [mathpixResults, setMathpixResults] = useState<MathpixResult[]>([]);
  const [wolframProgress, setWolframProgress] = useState(0);
  const [wolframResults, setWolframResults] = useState<WolframResult[]>([]);
  const [claudeFeedback, setClaudeFeedback] = useState<ClaudeFeedback>({ text: "", isComplete: false });
  const [analysisTime, setAnalysisTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setStage("idle");
      setMathpixProgress(0);
      setMathpixResults([]);
      setWolframProgress(0);
      setWolframResults([]);
      setClaudeFeedback({ text: "", isComplete: false });
      setAnalysisTime(0);
      setStartTime(null);

      // Fetch real data
      const fetchResults = async () => {
        const results = await fetchGradingResults();
        setMathpixResults(results.mathpix.flat());
        setWolframResults(results.wolfram.flat());
        setClaudeFeedback({ text: results.claude, isComplete: true });
      };
      fetchResults();

      // Start pipeline after brief delay
      const timer = setTimeout(() => {
        setStage("mathpix");
        setStartTime(Date.now());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Mathpix simulation
  useEffect(() => {
    if (stage !== "mathpix") return;

    const interval = setInterval(() => {
      setMathpixProgress((prev) => {
        const next = prev + 1;
        if (next <= questionCount) {
          setMathpixResults((r) => [...r, mathpixResults[next - 1] || mathpixResults[0]]);
        }
        if (next >= questionCount) {
          clearInterval(interval);
          setTimeout(() => setStage("wolfram"), 800);
        }
        return next;
      });
    }, 350);

    return () => clearInterval(interval);
  }, [stage, questionCount]);

  // Wolfram simulation
  useEffect(() => {
    if (stage !== "wolfram") return;

    const interval = setInterval(() => {
      setWolframProgress((prev) => {
        const next = prev + 1;
        if (next <= questionCount) {
          setWolframResults((r) => [...r, wolframResults[next - 1] || wolframResults[0]]);
        }
        if (next >= questionCount) {
          clearInterval(interval);
          setTimeout(() => setStage("claude"), 800);
        }
        return next;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [stage, questionCount]);

  // Claude simulation
  useEffect(() => {
    if (stage !== "claude") return;

    let partIndex = 0;
    const interval = setInterval(() => {
      if (partIndex < claudeFeedback.text.length) {
        setClaudeFeedback((prev) => ({
          text: prev.text.substring(0, partIndex + 1),
          isComplete: false,
        }));
        partIndex++;
      } else {
        clearInterval(interval);
        setClaudeFeedback((prev) => ({ ...prev, isComplete: true }));
        setTimeout(() => {
          setStage("complete");
          if (startTime) {
            setAnalysisTime(Math.round((Date.now() - startTime) / 1000));
          }
        }, 600);
      }
    }, 180);

    return () => clearInterval(interval);
  }, [stage, startTime]);

  const getStageStatus = useCallback((checkStage: PipelineStage) => {
    const order: PipelineStage[] = ["idle", "mathpix", "wolfram", "claude", "complete"];
    const currentIndex = order.indexOf(stage);
    const checkIndex = order.indexOf(checkStage);

    if (checkIndex < currentIndex || stage === "complete") return "complete";
    if (checkIndex === currentIndex) return "active";
    return "pending";
  }, [stage]);

  const correctCount = wolframResults.filter((r) => r.status === "correct").length;
  const partialCount = wolframResults.filter((r) => r.status === "partial").length;
  const incorrectCount = wolframResults.filter((r) => r.status === "incorrect").length;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-ink/60 backdrop-blur-xl" />

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          className="relative w-full max-w-5xl mx-4"
        >
          {/* Glassmorphism card */}
          <div className="relative rounded-[32px] bg-paper-raised/95 backdrop-blur-2xl shadow-card shadow-card ring-1 ring-paper-raised/50 overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-paper-secondary/30 to-paper-secondary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative px-10 pt-10 pb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-2 w-2 rounded-full bg-state-success animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-secondary">
                    WiseOS Grading Engine
                  </span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink">
                  {provTitle}
                </h1>
                <div className="mt-2 flex items-center gap-4 text-sm text-ink-secondary">
                  <span>{questionCount} questions identified</span>
                  <span className="h-1 w-1 rounded-full bg-paper-secondary" />
                  <span>Student: {studentName}</span>
                </div>
              </motion.div>
            </div>

            {/* Pipeline visualization */}
            <div className="relative px-10 py-8">
              <div className="flex items-stretch gap-4">
                {/* Mathpix Stage */}
                <PipelineStageCard
                  title="Mathpix OCR"
                  subtitle="Läser handskrivna lösningar"
                  status={getStageStatus("mathpix")}
                  progress={mathpixProgress}
                  total={questionCount}
                  accentColor="from-ink to-paper-secondary"
                >
                  {stage === "mathpix" && mathpixResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {mathpixResults.slice(-3).map((result, i) => (
                        <motion.div
                          key={result.questionNumber}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="text-ink-muted w-4">#{result.questionNumber}</span>
                          <span className="font-mono text-ink-secondary">{result.original}</span>
                          <span className="text-ink-muted">→</span>
                          <span className="font-mono text-ink font-medium">{result.converted}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </PipelineStageCard>

                {/* Connection line 1 */}
                <ConnectionLine active={getStageStatus("wolfram") !== "pending"} />

                {/* Wolfram Stage */}
                <PipelineStageCard
                  title="Wolfram Engine"
                  subtitle="Verifierar matematiska resonemang"
                  status={getStageStatus("wolfram")}
                  progress={wolframProgress}
                  total={questionCount}
                  accentColor="from-paper-secondary to-paper-secondary"
                >
                  {stage === "wolfram" && wolframResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {wolframResults.slice(-2).map((result) => (
                        <motion.div
                          key={result.questionNumber}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-ink-muted">Uppgift {result.questionNumber}</span>
                            <StatusBadge status={result.status} />
                          </div>
                          <div className="mt-1 text-[10px] text-ink-muted italic">
                            {result.verification}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {getStageStatus("wolfram") === "complete" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 flex items-center gap-3 text-xs"
                    >
                      <span className="text-state-success font-medium">{correctCount} korrekta</span>
                      <span className="text-state-warning font-medium">{partialCount} delvis</span>
                      <span className="text-state-danger font-medium">{incorrectCount} fel</span>
                    </motion.div>
                  )}
                </PipelineStageCard>

                {/* Connection line 2 */}
                <ConnectionLine active={getStageStatus("claude") !== "pending"} />

                {/* Claude Stage */}
                <PipelineStageCard
                  title="Claude AI"
                  subtitle="Genererar pedagogisk feedback"
                  status={getStageStatus("claude")}
                  progress={claudeFeedback.isComplete ? 100 : claudeFeedback.text.length}
                  total={100}
                  showProgress={false}
                  accentColor="from-ink to-paper-raised"
                >
                  {(stage === "claude" || stage === "complete") && claudeFeedback.text && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 text-xs text-ink-secondary leading-relaxed max-h-32 overflow-hidden"
                    >
                      {claudeFeedback.text}
                      {!claudeFeedback.isComplete && (
                        <span className="inline-block w-1.5 h-4 bg-ink ml-0.5 animate-pulse" />
                      )}
                    </motion.div>
                  )}
                </PipelineStageCard>
              </div>
            </div>

            {/* Results section */}
            <AnimatePresence>
              {stage === "complete" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-ink-hairline"
                >
                  <div className="px-10 py-8">
                    <div className="flex items-center justify-between">
                      {/* Score */}
                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                            Poäng
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-ink">
                            33<span className="text-ink-muted">/48</span>
                          </div>
                        </div>
                        <div className="h-12 w-px bg-paper-secondary" />
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                            Bedömning
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-state-warning">
                            C
                          </div>
                        </div>
                        <div className="h-12 w-px bg-paper-secondary" />
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                            Analystid
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-ink">
                            {analysisTime}<span className="text-lg text-ink-muted ml-1">sek</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={onClose}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-ink-secondary bg-paper-secondary hover:bg-paper-secondary transition-colors"
                        >
                          Publicera till elev
                        </button>
                        <button
                          onClick={onComplete}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-paper bg-gradient-to-r from-ink to-paper-secondary hover:from-paper-secondary hover:to-paper-secondary shadow-lg shadow-card transition-all"
                        >
                          Granska analys
                        </button>
                      </div>
                    </div>
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

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PipelineStageCard({
  title,
  subtitle,
  status,
  progress,
  total,
  showProgress = true,
  accentColor,
  children,
}: {
  title: string;
  subtitle: string;
  status: "pending" | "active" | "complete";
  progress: number;
  total: number;
  showProgress?: boolean;
  accentColor: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{
        scale: status === "active" ? 1.02 : 1,
        opacity: status === "pending" ? 0.5 : 1,
      }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={`relative flex-1 rounded-2xl p-5 transition-all ${
        status === "active"
          ? "bg-paper-raised shadow-card shadow-soft ring-1 ring-ink-hairline"
          : status === "complete"
          ? "bg-paper-secondary/80"
          : "bg-paper-secondary/50"
      }`}
    >
      {/* Active glow */}
      {status === "active" && (
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accentColor} opacity-5`} />
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${status === "pending" ? "text-ink-muted" : "text-ink"}`}>
              {title}
            </h3>
            {status === "complete" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-5 w-5 rounded-full bg-state-success flex items-center justify-center"
              >
                <svg className="h-3 w-3 text-paper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${status === "pending" ? "text-ink-muted" : "text-ink-secondary"}`}>
            {subtitle}
          </p>
        </div>

        {/* Progress counter */}
        {showProgress && status === "active" && (
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-ink">
              {progress}<span className="text-ink-muted">/{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && status !== "pending" && (
        <div className="relative mt-4 h-1.5 rounded-full bg-paper-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(progress / total) * 100}%` }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${accentColor}`}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}

function ConnectionLine({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 shrink-0">
      <div className="relative h-0.5 w-full">
        <div className="absolute inset-0 bg-paper-secondary rounded-full" />
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: active ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-gradient-to-r from-state-success to-state-success rounded-full origin-left"
        />
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1/2"
          >
            <div className="h-2 w-2 rounded-full bg-state-success shadow-lg shadow-state-success/50" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "correct" | "partial" | "incorrect" | "error" }) {
  const config = {
    correct: { label: "✓", bg: "bg-state-success/10", text: "text-state-success" },
    partial: { label: "~", bg: "bg-state-warning/10", text: "text-state-warning" },
    incorrect: { label: "✗", bg: "bg-state-danger/10", text: "text-state-danger" },
    error: { label: "!", bg: "bg-ink/10", text: "text-ink-muted" },
  };
  const c = config[status];

  return (
    <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
