"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  status: "correct" | "partial" | "incorrect";
  verification: string;
}

interface ClaudeFeedback {
  text: string;
  isComplete: boolean;
}

// ============================================================================
// DEMO DATA
// ============================================================================

const MATHPIX_DEMO: MathpixResult[] = [
  { questionNumber: 1, original: "F = m·a", converted: "F = ma" },
  { questionNumber: 2, original: "v = v₀ + a·t", converted: "v = v₀ + at" },
  { questionNumber: 3, original: "s = ½·a·t²", converted: "s = ½at²" },
  { questionNumber: 4, original: "p = m·v", converted: "p = mv" },
  { questionNumber: 5, original: "I = F·Δt", converted: "I = FΔt" },
  { questionNumber: 6, original: "F = k·x", converted: "F = kx" },
  { questionNumber: 7, original: "T = 2π√(m/k)", converted: "T = 2π√(m/k)" },
  { questionNumber: 8, original: "T = 2π√(L/g)", converted: "T = 2π√(L/g)" },
  { questionNumber: 9, original: "E_k = ½mv²", converted: "Eₖ = ½mv²" },
  { questionNumber: 10, original: "v = f·λ", converted: "v = fλ" },
  { questionNumber: 11, original: "d·sin(θ) = nλ", converted: "d sin θ = nλ" },
  { questionNumber: 12, original: "f = f₀·v/(v-v_s)", converted: "f = f₀v/(v−vₛ)" },
];

const WOLFRAM_DEMO: WolframResult[] = [
  { questionNumber: 1, studentAnswer: "3.1 m/s²", expectedAnswer: "3.1 m/s²", status: "correct", verification: "Kinematisk ekvation verifierad" },
  { questionNumber: 2, studentAnswer: "5.4 m", expectedAnswer: "5.4 m", status: "correct", verification: "Projektilbana beräknad" },
  { questionNumber: 3, studentAnswer: "3.0 m/s²", expectedAnswer: "3.0 m/s²", status: "correct", verification: "Newtons andra lag tillämpad" },
  { questionNumber: 4, studentAnswer: "4 m/s, 24 m/s", expectedAnswer: "4 m/s, 24 m/s", status: "correct", verification: "Rörelsemängd bevarad" },
  { questionNumber: 5, studentAnswer: "19 Ns", expectedAnswer: "19 Ns (med riktning)", status: "partial", verification: "Vektorriktning saknas" },
  { questionNumber: 6, studentAnswer: "54 N, 3.2 J", expectedAnswer: "54 N, 3.24 J", status: "correct", verification: "Hookes lag verifierad" },
  { questionNumber: 7, studentAnswer: "0.31 s", expectedAnswer: "0.31 s", status: "partial", verification: "Formelförvirring i mellanled" },
  { questionNumber: 8, studentAnswer: "2.8 s", expectedAnswer: "2.84 s", status: "correct", verification: "Pendelperiod korrekt" },
  { questionNumber: 9, studentAnswer: "9.9 m/s", expectedAnswer: "7.8 m/s", status: "incorrect", verification: "Friktion ej inkluderad" },
  { questionNumber: 10, studentAnswer: "0.78 m", expectedAnswer: "0.78 m", status: "correct", verification: "Vågekvation tillämpad" },
  { questionNumber: 11, studentAnswer: "5.1 mm", expectedAnswer: "5.1 mm", status: "incorrect", verification: "Inkonsekvent lösningsgång" },
  { questionNumber: 12, studentAnswer: "548 Hz", expectedAnswer: "548 Hz", status: "correct", verification: "Dopplereffekt korrekt" },
];

const CLAUDE_FEEDBACK_PARTS = [
  "Bra arbete, Elin! ",
  "Du visar god förståelse för grundläggande mekanik och vågrörelser. ",
  "Dina lösningar på kastparabel och rörelsemängd är exemplariska med tydliga mellanled.\n\n",
  "I uppgift 5 glömde du ange riktning på impulsen – ",
  "kom ihåg att impuls är en vektorstorhet.\n\n",
  "Uppgift 9 kräver att du inkluderar friktionsarbetet. ",
  "Du identifierade friktionen men valde att ignorera den, ",
  "vilket gav ett för högt svar.\n\n",
  "Tips: Kontrollera alltid vilka krafter som verkar ",
  "och om energi förloras i systemet.",
];

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
          setMathpixResults((r) => [...r, MATHPIX_DEMO[next - 1] || MATHPIX_DEMO[0]]);
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
          setWolframResults((r) => [...r, WOLFRAM_DEMO[next - 1] || WOLFRAM_DEMO[0]]);
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
      if (partIndex < CLAUDE_FEEDBACK_PARTS.length) {
        setClaudeFeedback((prev) => ({
          text: prev.text + CLAUDE_FEEDBACK_PARTS[partIndex],
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
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
        
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl mx-4"
        >
          {/* Glassmorphism card */}
          <div className="relative rounded-[32px] bg-white/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-white/50 overflow-hidden">
            
            {/* Ambient glow */}
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/30 to-fuchsia-400/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
            
            {/* Header */}
            <div className="relative px-10 pt-10 pb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    WiseOS rättar provet
                  </span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  {provTitle}
                </h1>
                <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                  <span>{questionCount} uppgifter identifierade</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>Elev: {studentName}</span>
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
                  accentColor="from-orange-500 to-amber-500"
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
                          <span className="text-slate-400 w-4">#{result.questionNumber}</span>
                          <span className="font-mono text-slate-500">{result.original}</span>
                          <span className="text-slate-300">→</span>
                          <span className="font-mono text-slate-900 font-medium">{result.converted}</span>
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
                  accentColor="from-red-500 to-orange-500"
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
                            <span className="text-slate-400">Uppgift {result.questionNumber}</span>
                            <StatusBadge status={result.status} />
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400 italic">
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
                      <span className="text-emerald-600 font-medium">{correctCount} korrekta</span>
                      <span className="text-amber-600 font-medium">{partialCount} delvis</span>
                      <span className="text-red-600 font-medium">{incorrectCount} fel</span>
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
                  accentColor="from-violet-500 to-purple-500"
                >
                  {(stage === "claude" || stage === "complete") && claudeFeedback.text && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 text-xs text-slate-600 leading-relaxed max-h-32 overflow-hidden"
                    >
                      {claudeFeedback.text}
                      {!claudeFeedback.isComplete && (
                        <span className="inline-block w-1.5 h-4 bg-violet-500 ml-0.5 animate-pulse" />
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
                  className="border-t border-slate-100"
                >
                  <div className="px-10 py-8">
                    <div className="flex items-center justify-between">
                      {/* Score */}
                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                            Poäng
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-slate-900">
                            33<span className="text-slate-300">/48</span>
                          </div>
                        </div>
                        <div className="h-12 w-px bg-slate-200" />
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                            Bedömning
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-amber-600">
                            C
                          </div>
                        </div>
                        <div className="h-12 w-px bg-slate-200" />
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                            Analystid
                          </div>
                          <div className="text-4xl font-semibold tracking-tight text-slate-900">
                            {analysisTime}<span className="text-lg text-slate-400 ml-1">sek</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={onClose}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Publicera till elev
                        </button>
                        <button
                          onClick={onComplete}
                          className="px-6 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 shadow-lg shadow-slate-900/20 transition-all"
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
          ? "bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-200"
          : status === "complete"
          ? "bg-slate-50/80"
          : "bg-slate-50/50"
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
            <h3 className={`font-semibold ${status === "pending" ? "text-slate-400" : "text-slate-900"}`}>
              {title}
            </h3>
            {status === "complete" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${status === "pending" ? "text-slate-300" : "text-slate-500"}`}>
            {subtitle}
          </p>
        </div>
        
        {/* Progress counter */}
        {showProgress && status === "active" && (
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-slate-900">
              {progress}<span className="text-slate-300">/{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && status !== "pending" && (
        <div className="relative mt-4 h-1.5 rounded-full bg-slate-200 overflow-hidden">
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
        <div className="absolute inset-0 bg-slate-200 rounded-full" />
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: active ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full origin-left"
        />
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1/2"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "correct" | "partial" | "incorrect" }) {
  const config = {
    correct: { label: "✓", bg: "bg-emerald-100", text: "text-emerald-700" },
    partial: { label: "~", bg: "bg-amber-100", text: "text-amber-700" },
    incorrect: { label: "✗", bg: "bg-red-100", text: "text-red-700" },
  };
  const c = config[status];
  
  return (
    <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
