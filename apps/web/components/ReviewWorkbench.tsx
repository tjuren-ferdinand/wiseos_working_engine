"use client";

import { useState } from "react";
import { useStore, actions, type Prov, type StudentResult, type Klass } from "@/lib/store";
import Surface from "./ui/Surface";
import EmptyState from "./ui/EmptyState";
import StatusBadge from "./ui/StatusBadge";
import LineIcon from "./LineIcon";
import PublishResultsModal from "./PublishResultsModal";

export default function ReviewWorkbench() {
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const klasser = useStore((s) => s.klasser);
  const [selectedProv, setSelectedProv] = useState<Prov | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [editingStep, setEditingStep] = useState<{ resultId: string; stepId: string } | null>(null);
  const [editPoints, setEditPoints] = useState<string>("");

  // Prov ready for review or already published.
  const completedProv = prov.filter((p) => p.status === "review" || p.status === "published");

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
          const published = p.status === "published";

          return (
            <Surface
              key={p.id}
              onClick={() => setSelectedProv(p)}
              interactive
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-medium text-ink">{p.title}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-secondary">{klass?.name}</p>
                </div>
                <StatusBadge status={published ? "published" : "review"} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-muted">
                <LineIcon name="users" className="h-3.5 w-3.5" />
                {provResults.length} elever
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
            {getProvResults(selectedProv.id).map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                klass={getKlass(selectedProv.id)}
                editingStep={editingStep}
                editPoints={editPoints}
                onEditStep={startEditStep}
                onPointsChange={setEditPoints}
                onSave={saveStep}
                onCancel={() => setEditingStep(null)}
              />
            ))}
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

function ResultCard({
  result,
  klass,
  editingStep,
  editPoints,
  onEditStep,
  onPointsChange,
  onSave,
  onCancel,
}: {
  result: StudentResult;
  klass?: Klass;
  editingStep: { resultId: string; stepId: string } | null;
  editPoints: string;
  onEditStep: (result: StudentResult, stepId: string) => void;
  onPointsChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
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

      <div className="mt-5 border-t border-ink-hairline pt-4">
        <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted mb-3">
          Uppgifter
        </div>
        <div className="space-y-3">
          {result.steps.map((step) => {
            const isEditing =
              editingStep?.resultId === result.id && editingStep?.stepId === step.id;
            return (
              <div
                key={step.id}
                className="flex items-start justify-between gap-4 rounded-[10px] bg-paper-secondary border border-ink-hairline p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{step.label}</span>
                    <span
                      className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        step.status === "correct"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : step.status === "partial"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : step.status === "incorrect"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-ink/[0.04] text-ink-muted border-ink-hairline"
                      }`}
                    >
                      {step.status === "correct"
                        ? "Rätt"
                        : step.status === "partial"
                          ? "Delvis"
                          : step.status === "incorrect"
                            ? "Fel"
                            : "Väntar"}
                    </span>
                  </div>
                  {step.feedback && (
                    <p className="mt-1.5 text-[12.5px] text-ink-secondary leading-relaxed">
                      {step.feedback}
                    </p>
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
                        max={step.maxPoints}
                      />
                      <span className="text-[13px] text-ink-muted">/ {step.maxPoints}</span>
                      <button onClick={onSave} className="btn-primary h-8 px-2.5">
                        <LineIcon name="check" className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={onCancel} className="btn-secondary h-8 px-2.5">
                        <LineIcon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onEditStep(result, step.id)}
                      className="flex items-center gap-2 text-[13px] text-ink-secondary hover:text-ink"
                    >
                      <LineIcon name="pen" className="h-3.5 w-3.5" />
                      {step.earnedPoints} / {step.maxPoints}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
