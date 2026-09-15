"use client";

import { useState } from "react";
import { useStore, actions, type StudentResult, type Prov } from "@/lib/store";
import LineIcon from "./LineIcon";

interface PublishResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prov: Prov;
  results: StudentResult[];
}

export default function PublishResultsModal({
  isOpen,
  onClose,
  prov,
  results,
}: PublishResultsModalProps) {
  const klasser = useStore((s) => s.klasser);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  if (!isOpen) return null;

  const klass = klasser.find((k) => k.id === prov.klassId);

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    try {
      await actions.publishResults(prov.id);
      setIsPublishing(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1800);
    } catch (e) {
      setIsPublishing(false);
      setPublishError((e as Error).message);
    }
  };

  const percentageToGrade = (pct: number): string => {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    if (pct >= 50) return "E";
    return "F";
  };

  const gradeClass = (grade: string): string => {
    switch (grade) {
      case "A":
      case "B":
        return "bg-state-success/10 text-state-success";
      case "C":
      case "D":
        return "bg-state-warning/10 text-state-warning";
      case "E":
        return "bg-state-warning/10 text-state-warning";
      default:
        return "bg-state-danger/10 text-state-danger";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl rounded-[20px] bg-paper-raised border border-ink-hairline shadow-elevated overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-hairline">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-medium text-ink">Publicera resultat</h2>
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                {prov.title} · {klass?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-[10px] p-2 text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-colors"
            >
              <LineIcon name="x" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <p className="text-[13.5px] text-ink-secondary mb-4">
            Publiceringen gör alla {results.length} resultat synliga för klassen. Du kan
            fortfarande ändra resultat efter publicering.
          </p>
          {(() => {
            const reviewable = results.flatMap((r) => r.steps).filter((s) => !s.error && s.found !== false);
            const unreviewed = reviewable.filter((s) => !s.reviewed).length;
            const flagged = reviewable.filter((s) => s.status === "needs_review").length;
            return unreviewed > 0 ? (
              <div className="mb-4 rounded-xl border border-state-warning/25 bg-state-warning/[0.07] px-4 py-3 text-[13px] leading-relaxed text-ink">
                <span className="font-medium">Ogranskade steg:</span> {unreviewed} av {reviewable.length}
                {flagged > 0 && <> — varav {flagged} är flaggade som “behöver granskas”</>}.
                Du kan publicera ändå, men ogranskade AI-bedömningar följer med som de är.
              </div>
            ) : null;
          })()}
          <div className="space-y-3">
            {results.map((result) => {
              const grade = percentageToGrade(result.percentage);
              return (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-paper-secondary border border-ink-hairline"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-ink/[0.04] border border-ink-hairline grid place-items-center text-[14px] font-medium text-ink">
                      {result.studentName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-ink">{result.studentName}</div>
                      <div className="text-[12.5px] text-ink-secondary">
                        {result.totalScore}/{result.maxScore} poäng
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[13px] font-medium ${gradeClass(grade)}`}>
                    {grade}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-ink-hairline bg-paper-secondary">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[13px] text-ink-secondary">
              {publishError ? (
                <span className="text-state-danger">{publishError}</span>
              ) : (
                `${results.length} elever kommer att publiceras`
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary">
                Avbryt
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || showSuccess}
                className="btn-primary"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-ink-hairline border-t-ink rounded-full animate-spin" />
                    Publicerar...
                  </span>
                ) : showSuccess ? (
                  <span className="flex items-center gap-2">
                    <LineIcon name="check" className="h-4 w-4" />
                    Publicerat
                  </span>
                ) : (
                  "Publicera"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
