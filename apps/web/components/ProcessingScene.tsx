"use client";

import { useEffect } from "react";
import Link from "next/link";
import { actions, type Klass, type Prov, useStore } from "@/lib/store";
import LineIcon from "./LineIcon";

const PHASE_LABELS: Record<string, string> = {
  uploading: "Laddar upp originaldokument",
  processing: "Analyserar dokument och bedömer svar",
  saving: "Sparar resultat",
  done: "Rättningen är klar",
  error: "Rättningen misslyckades",
};

export default function ProcessingScene({
  prov,
  klass,
  onBack,
}: {
  prov: Prov;
  klass: Klass;
  onBack: () => void;
}) {
  const progress = useStore((state) => state.batchProgress[prov.id]);
  const error = useStore((state) => state.error);

  useEffect(() => {
    const interval = window.setInterval(() => void actions.hydrate(), 3000);
    return () => window.clearInterval(interval);
  }, []);

  const phase = progress?.phase ?? "processing";
  const label = PHASE_LABELS[phase] ?? "Kontrollerar rättningsstatus";
  const isError = phase === "error";

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-ink-hairline bg-paper-elevated p-8 shadow-card sm:p-10">
      <div className="flex items-start gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
            isError
              ? "bg-state-danger/10 text-state-danger"
              : "bg-ink/5 text-ink"
          }`}
        >
          <LineIcon
            name={isError ? "x" : phase === "done" ? "check" : "sparkles"}
            className={`h-6 w-6 ${phase !== "error" && phase !== "done" ? "animate-pulse" : ""}`}
          />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            {isError ? "Ett fel uppstod" : "WiseOS rättningsjobb"}
          </div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
            {prov.title}
          </h2>
          <div className="mt-1 text-[13px] text-ink-secondary">
            {klass.name}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-paper-raised p-5 sm:p-6">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
          {isError
            ? error || "Öppna provet igen eller starta om rättningen från klassen."
            : "Sidan kontrollerar backendens sparade status automatiskt. Providersteg visas endast när backend faktiskt rapporterar dem."}
        </p>
      </div>

      {phase !== "error" && phase !== "done" && (
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-paper-secondary">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-ink" />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          <LineIcon name="chevron-down" className="h-4 w-4 -rotate-90" />
          Tillbaka till {klass.name}
        </button>

        {phase !== "error" && (
          <Link
            href={`/classes/${klass.id}`}
            className="inline-flex items-center gap-2 rounded-[10px] bg-paper-secondary px-4 py-2 text-[13px] font-medium text-ink hover:bg-paper transition-colors"
          >
            <LineIcon name="grid" className="h-4 w-4" />
            Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
