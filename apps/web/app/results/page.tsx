"use client";

import { useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";

export default function ResultsPage() {
  const results = useStore((s) => s.results);
  const prov = useStore((s) => s.prov);
  const klasser = useStore((s) => s.klasser);

  // A result is "published" when its parent prov has been published.
  const publishedProvIds = new Set(
    prov.filter((p) => p.status === "published").map((p) => p.id),
  );
  const publishedResults = results.filter((r) => publishedProvIds.has(r.provId));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Översikt"
        title="Resultat"
        subtitle="Publicerade resultat för dina elever."
      />

      {publishedResults.length === 0 ? (
        <EmptyState
          icon="chart"
          title="Inga publicerade resultat"
          description="Rätta och publicera prov för att se resultat här."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishedResults.map((r) => {
            const provData = prov.find((p) => p.id === r.provId);
            const klass = klasser.find((k) => k.id === provData?.klassId);
            const totalPoints = r.totalScore;
            const maxPoints = r.maxScore;
            const pct = r.percentage;

            return (
              <Surface key={r.id} padding="p-5">
                <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted truncate">
                  {klass?.name || "Okänd klass"} · {provData?.title || "Okänt prov"}
                </div>
                <div className="mt-1.5 text-[15px] font-medium text-ink">{r.studentName}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[28px] font-medium tracking-[-0.01em] text-ink tabular-nums">
                    {totalPoints}/{maxPoints}
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-[13px] font-medium tabular-nums ${
                    pct >= 80 ? "bg-state-success/10 text-state-success" : pct >= 50 ? "bg-state-warning/10 text-state-warning" : "bg-state-danger/10 text-state-danger"
                  }`}>
                    {pct}%
                  </span>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
