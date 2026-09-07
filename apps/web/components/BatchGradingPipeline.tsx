"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

import type { AnswerKeyItem } from "@/lib/api";
import { actions, runBatchGrade, type GradingParams, type StudentResult } from "@/lib/store";
import GradingFlowScene, { type FlowParam, type FlowPhase, type FlowStudent } from "./GradingFlowScene";

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
  const [flowStudents, setFlowStudents] = useState<FlowStudent[]>([]);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
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
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      setPhase("idle");
      setError(null);
      setResults([]);
      setFlowStudents([]);
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

  // --- Elevkort: seeda från filnamn, staggera till "working", fyll med riktiga
  // resultat när batchen returnerar (backend är single-shot → simulerad takt).
  useEffect(() => {
    if (!open || files.length === 0) return;
    setFlowStudents(
      files.map((f, i) => ({
        id: `f${i}`,
        name: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
        status: "queued" as const,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== "processing") return;
    files.forEach((_, i) => {
      timersRef.current.push(
        window.setTimeout(() => {
          setFlowStudents((prev) =>
            prev.map((s, j) => (j === i && s.status === "queued" ? { ...s, status: "working" } : s)),
          );
        }, 500 + i * 800),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (results.length === 0) return;
    results.forEach((r, i) => {
      timersRef.current.push(
        window.setTimeout(() => {
          setFlowStudents((prev) =>
            prev.map((s, j) =>
              j === i
                ? {
                    ...s,
                    name: r.studentName || s.name,
                    status: "done",
                    score: r.totalScore,
                    maxScore: r.maxScore,
                    percentage: r.percentage,
                  }
                : s,
            ),
          );
        }, i * 300),
      );
    });
  }, [results]);

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="batch-overlay"
        initial={{ opacity: 0, scale: 0.94, borderRadius: 28 }}
        animate={{ opacity: 1, scale: 1, borderRadius: 0 }}
        exit={{ opacity: 0, scale: 0.94, borderRadius: 28 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[300] overflow-hidden"
        style={{
          background: "rgb(var(--background))",
          transformOrigin: "center center",
        }}
      >
        <GradingFlowScene
          provTitle={provTitle}
          phase={phase as FlowPhase}
          students={flowStudents}
          totalCount={expectedStudents || files.length}
          error={error}
          onClose={onClose}
          onReview={phase === "complete" ? () => onComplete(results) : undefined}
        />
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
