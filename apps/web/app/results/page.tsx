"use client";

import { useStore, deriveStep } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";

export default function ResultsPage() {
  const results = useStore((s) => s.results);
  const prov = useStore((s) => s.prov);
  const klasser = useStore((s) => s.klasser);

  const publishedResults = results.filter((r) => r.isPublished);

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
            const totalPoints = r.steps.reduce((sum, s) => {
              const d = deriveStep(s);
              return sum + d.displayedPoints;
            }, 0);
            const maxPoints = r.steps.reduce((sum, s) => sum + s.pointsMax, 0);
            const pct = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

            return (
              <Surface key={r.id} padding="p-5">
                <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted truncate">
                  {klass?.name || "Okänd klass"} · {provData?.title || "Okänt prov"}
                </div>
                <div className="mt-1.5 text-[15px] font-medium text-ink">{r.studentName}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[24px] font-medium tracking-[-0.01em] text-ink tabular-nums">
                    {totalPoints}/{maxPoints}
                  </span>
                  <span className={`text-[13px] font-medium tabular-nums ${
                    pct >= 80 ? "text-accent" : pct >= 50 ? "text-ink-secondary" : "text-state-danger"
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
