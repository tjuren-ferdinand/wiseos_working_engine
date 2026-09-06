"use client";

interface GradingPipelineProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  studentName: string;
  provTitle: string;
  questionCount: number;
}

export default function GradingPipeline({
  open,
  onClose,
  studentName,
  provTitle,
}: GradingPipelineProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-ink-hairline bg-paper-raised p-6 shadow-card" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-xl font-semibold text-ink">Omrättning kräver originalunderlaget</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Starta en ny rättning från klassen för {provTitle} och välj originalfilerna för {studentName}. WiseOS visar aldrig simulerade providerresultat eller hårdkodade poäng.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary">Stäng</button>
        </div>
      </div>
    </div>
  );
}
