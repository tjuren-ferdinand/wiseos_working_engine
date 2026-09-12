"use client";

import { useEffect, useState } from "react";
import { useStore, actions, type Prov, type StudentResult, type Klass, type Question } from "@/lib/store";
import { useTheme, type ReviewLayout } from "@/lib/theme";
import Surface from "./ui/Surface";
import EmptyState from "./ui/EmptyState";
import StatusBadge from "./ui/StatusBadge";
import LineIcon from "./LineIcon";
import MathText from "./Math";
import PublishResultsModal from "./PublishResultsModal";
import "katex/dist/katex.min.css";

export default function ReviewWorkbench() {
  const { reviewLayout } = useTheme();
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const klasser = useStore((s) => s.klasser);
  const [selectedProv, setSelectedProv] = useState<Prov | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [editingStep, setEditingStep] = useState<{ resultId: string; stepId: string } | null>(null);
  const [editPoints, setEditPoints] = useState<string>("");

  // Prov in the review pipeline: currently grading or ready for review.
  // Published prov does not appear here — it is shown on the results/elev side.
  const completedProv = prov.filter((p) => p.status === "grading" || p.status === "review");

  useEffect(() => {
    if (selectedProv && !completedProv.some((p) => p.id === selectedProv.id)) {
      setSelectedProv(null);
      setShowPublish(false);
    }
  }, [completedProv, selectedProv]);

  useEffect(() => {
    // Poll while any prov is still being graded so the list becomes
    // clickable as soon as AI grading completes — no page reload needed.
    if (!completedProv.some((p) => p.status === "grading")) return;

    const timer = setInterval(() => {
      actions.hydrate().catch(() => {});
    }, 5000);

    return () => clearInterval(timer);
  }, [completedProv]);

  const getKlass = (provId: string): Klass | undefined => {
    const p = prov.find((pr) => pr.id === provId);
    return p ? klasser.find((k) => k.id === p.klassId) : undefined;
  };

  const getProvResults = (provId: string): StudentResult[] =>
    results.filter((r) => r.provId === provId);

  const startEditStep = (result: StudentResult, stepId: string) => {
    const step = result.steps.find((s) => s.id === stepId);
    if (!step) return;
    setEditingStep({ resultId: result.id, stepId });
    setEditPoints(String(step.earnedPoints));
  };

  const saveStep = () => {
    if (!editingStep) return;
    const points = Number(editPoints);
    if (Number.isNaN(points) || points < 0) return;
    actions.updateStep(editingStep.resultId, editingStep.stepId, { earnedPoints: points });
    setEditingStep(null);
  };

  if (completedProv.length === 0) {
    return (
      <EmptyState
        icon="edit"
        title="Inga rättade prov att granska"
        description="När ett prov har rättats dyker det upp här för granskning och publicering."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {completedProv.map((p) => {
          const klass = getKlass(p.id);
          const provResults = getProvResults(p.id);
          const isGrading = p.status === "grading";

          return (
            <Surface
              key={p.id}
              onClick={isGrading ? undefined : () => setSelectedProv(p)}
              interactive={!isGrading}
              className={isGrading ? "opacity-60" : ""}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-medium text-ink">{p.title}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-secondary">{klass?.name}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-muted">
                <LineIcon name="users" className="h-3.5 w-3.5" />
                {isGrading ? "Rättar..." : `${provResults.length} elever`}
              </div>
            </Surface>
          );
        })}
      </div>

      {selectedProv && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[20px] font-medium tracking-[-0.01em] text-ink">
                {selectedProv.title}
              </h3>
              <p className="mt-1 text-[13.5px] text-ink-secondary">
                {getProvResults(selectedProv.id).length} elever ·{" "}
                {selectedProv.status === "published" ? "publicerat" : "redo för granskning"}
              </p>
            </div>
            {selectedProv.status === "review" && (
              <button onClick={() => setShowPublish(true)} className="btn-primary">
                <LineIcon name="check" className="h-4 w-4" />
                Publicera resultat
              </button>
            )}
          </div>

          <div className="space-y-4">
            {(() => {
              const provResults = getProvResults(selectedProv.id);
              const questions = deriveQuestions(provResults);
              return provResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  questions={questions}
                  klass={getKlass(selectedProv.id)}
                  editingStep={editingStep}
                  editPoints={editPoints}
                  onEditStep={startEditStep}
                  onPointsChange={setEditPoints}
                  onSave={saveStep}
                  onCancel={() => setEditingStep(null)}
                  layout={reviewLayout}
                />
              ));
            })()}
          </div>
        </div>
      )}

      {selectedProv && (
        <PublishResultsModal
          isOpen={showPublish}
          onClose={() => setShowPublish(false)}
          prov={selectedProv}
          results={getProvResults(selectedProv.id)}
        />
      )}
    </div>
  );
}

function deriveQuestions(results: StudentResult[]): Question[] {
  const seen = new Map<string, Question>();
  for (const result of results) {
    for (const step of result.steps) {
      if (!seen.has(step.questionId)) {
        seen.set(step.questionId, {
          id: `q-${step.questionId}`,
          number: step.questionId,
          maxPoints: step.maxPoints,
        });
      }
    }
  }
  return Array.from(seen.values());
}

function ResultCard({
  result,
  questions,
  klass,
  editingStep,
  editPoints,
  onEditStep,
  onPointsChange,
  onSave,
  onCancel,
  layout = "split",
}: {
  result: StudentResult;
  questions: Question[];
  klass?: Klass;
  editingStep: { resultId: string; stepId: string } | null;
  editPoints: string;
  onEditStep: (result: StudentResult, stepId: string) => void;
  onPointsChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  layout?: ReviewLayout;
}) {
  const isImage = (url: string) => /^data:image\/(png|jpeg|jpg|webp|gif);/.test(url);
  const scanPage = result.scanPages?.[0];
  const showScan = layout !== "compact" && !!scanPage;

  const scanBlock = scanPage ? (
    <div className={layout === "stacked" ? "border-t border-ink-hairline pt-4" : "border-t border-ink-hairline pt-4"}>
      <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted mb-2">
        Originalskanning
      </div>
      {isImage(scanPage) ? (
        <img
          src={scanPage}
          alt="Elevens originalskanning"
          className={`rounded-xl border border-ink-hairline object-contain ${
            layout === "stacked" ? "max-h-64 w-full" : "max-h-96"
          }`}
        />
      ) : (
        <a
          href={scanPage}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Visa originalfil
        </a>
      )}
    </div>
  ) : null;

  return (
    <Surface padding="p-5">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-[12px] bg-ink/[0.04] border border-ink-hairline grid place-items-center text-[15px] font-medium text-ink">
          {result.studentName.charAt(0)}
        </div>
        <div>
          <h4 className="text-[15px] font-medium text-ink">{result.studentName}</h4>
          <p className="text-[13px] text-ink-secondary">
            {result.totalScore}/{result.maxScore} poäng · {result.percentage}%
          </p>
        </div>
      </div>

      {layout === "stacked" && showScan && <div className="mt-5">{scanBlock}</div>}

      <div className={layout === "split" ? "mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5" : "mt-0"}>
      {layout === "split" && showScan && scanBlock}

      <div className="mt-5 border-t border-ink-hairline pt-4">
        <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted mb-3">
          Uppgifter
        </div>
        <div className={layout === "compact" ? "space-y-2" : "space-y-3"}>
          {questions.map((q) => {
            const step = result.steps.find((s) => s.questionId === q.number);
            const status = step?.status ?? "pending";
            const label = step?.label ?? `Uppgift ${q.number}`;
            const maxPoints = step?.maxPoints ?? q.maxPoints;
            const earnedPoints = step?.earnedPoints ?? 0;
            const isEditing =
              step && editingStep?.resultId === result.id && editingStep?.stepId === step.id;
            return (
              <div
                key={step ? step.id : `q-${q.id}`}
                className={`flex items-start justify-between gap-4 rounded-[10px] bg-paper-secondary border border-ink-hairline ${
                  layout === "compact" ? "p-2.5" : "p-3"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{label}</span>
                    <span
                      className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        status === "correct"
                          ? "bg-state-success/10 text-state-success border-state-success/20"
                          : status === "partial"
                            ? "bg-state-warning/10 text-state-warning border-state-warning/20"
                            : status === "incorrect"
                              ? "bg-state-danger/10 text-state-danger border-state-danger/20"
                              : status === "needs_review"
                                ? "bg-state-warning/10 text-state-warning border-state-warning/20"
                                : "bg-ink/[0.04] text-ink-muted border-ink-hairline"
                      }`}
                    >
                      {status === "correct"
                        ? "Rätt"
                        : status === "partial"
                          ? "Delvis"
                          : status === "incorrect"
                            ? "Fel"
                            : status === "needs_review"
                              ? "Behöver granskas"
                              : "Väntar"}
                    </span>
                  </div>
                  {layout !== "compact" && (
                    <>
                      {step?.questionText && (
                        <p className="mt-1.5 text-[12.5px] text-ink-secondary leading-relaxed">
                          <span className="font-medium text-ink">Fråga:</span> <MathText content={step.questionText} />
                        </p>
                      )}
                      {step?.studentWork !== undefined && (
                        <p className="mt-1 text-[12.5px] text-ink-secondary leading-relaxed">
                          <span className="font-medium text-ink">Elevens svar:</span> <MathText content={step.studentWork || "(inte extraherat)"} />
                        </p>
                      )}
                      {step?.correctAnswer && (
                        <p className="mt-1 text-[12.5px] text-ink-secondary leading-relaxed">
                          <span className="font-medium text-ink">Facit:</span> <MathText content={step.correctAnswer} />
                        </p>
                      )}
                      {step?.feedback && (
                        <p className="mt-1 text-[12.5px] text-ink-secondary leading-relaxed">
                          <span className="font-medium text-ink">AI-analys:</span> <MathText content={step.feedback} />
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editPoints}
                        onChange={(e) => onPointsChange(e.target.value)}
                        className="input w-20 h-8 py-1 text-center"
                        min={0}
                        max={maxPoints}
                      />
                      <span className="text-[13px] text-ink-muted">/ {maxPoints}</span>
                      <button onClick={onSave} className="btn-primary h-8 px-2.5">
                        <LineIcon name="check" className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={onCancel} className="btn-secondary h-8 px-2.5">
                        <LineIcon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : step ? (
                    <button
                      onClick={() => onEditStep(result, step.id)}
                      className="flex items-center gap-2 text-[13px] text-ink-secondary hover:text-ink"
                    >
                      <LineIcon name="pen" className="h-3.5 w-3.5" />
                      {earnedPoints} / {maxPoints}
                    </button>
                  ) : (
                    <span className="text-[13px] text-ink-muted">— / {maxPoints}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </Surface>
  );
}
