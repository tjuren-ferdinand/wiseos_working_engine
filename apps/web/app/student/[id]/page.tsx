"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";
import LineIcon from "@/components/LineIcon";

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const results = useStore((s) => s.results);
  const prov = useStore((s) => s.prov);

  const studentResults = useMemo(
    () => results.filter((r) => r.studentId === params.id),
    [results, params.id],
  );

  const studentName = studentResults[0]?.studentName ?? "Okänd elev";

  const provStats = useMemo(() => {
    return studentResults
      .map((result) => {
        const provData = prov.find((p) => p.id === result.provId);
        return {
          result,
          provData,
          points: result.totalScore,
          maxPoints: result.maxScore,
          percentage: result.percentage,
          date: provData?.createdAt ?? result.provId,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentResults, prov]);

  const trend = useMemo(() => {
    if (provStats.length < 2) return { direction: "stable" as const, change: 0 };
    const first = provStats[0].percentage;
    const last = provStats[provStats.length - 1].percentage;
    const change = last - first;
    return {
      direction: change > 5 ? "up" : change < -5 ? "down" : "stable" as const,
      change: Math.abs(change),
    };
  }, [provStats]);

  const analysis = useMemo(() => {
    const allSteps = studentResults.flatMap((r) => r.steps);
    const stepsByLabel = new Map<string, { correct: number; total: number }>();

    allSteps.forEach((step) => {
      const existing = stepsByLabel.get(step.label) ?? { correct: 0, total: 0 };
      const isCorrect = step.earnedPoints >= step.maxPoints * 0.8;
      stepsByLabel.set(step.label, {
        correct: existing.correct + (isCorrect ? 1 : 0),
        total: existing.total + 1,
      });
    });

    const topics = Array.from(stepsByLabel.entries()).map(([label, stats]) => ({
      label,
      successRate: Math.round((stats.correct / stats.total) * 100),
    }));

    return {
      strengths: topics.filter((t) => t.successRate >= 80).slice(0, 3),
      weaknesses: topics.filter((t) => t.successRate < 50).slice(0, 3),
    };
  }, [studentResults]);

  if (studentResults.length === 0) {
    return (
      <div className="space-y-10">
        <PageHeader eyebrow="Elev" title={studentName} />
        <EmptyState
          icon="users"
          title="Ingen data för denna elev"
          description="Det finns inga rättade resultat ännu."
          action={
            <Link href="/" className="btn-secondary mt-6 inline-flex">
              ← Tillbaka till dashboard
            </Link>
          }
        />
      </div>
    );
  }

  const avgPercentage = Math.round(
    provStats.reduce((sum, s) => sum + s.percentage, 0) / provStats.length,
  );

  const grade = percentageToGrade(avgPercentage);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Elev"
        title={studentName}
        subtitle={`${provStats.length} prov · Genomsnitt ${avgPercentage}%`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Surface padding="p-6">
          <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted">
            Genomsnitt
          </div>
          <div className="mt-2 text-[36px] font-medium tracking-[-0.02em] text-ink tabular-nums">
            {avgPercentage}%
          </div>
        </Surface>

        <Surface padding="p-6">
          <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted">
            Betyg
          </div>
          <div
            className={`mt-2 inline-flex items-center px-3 py-1 rounded-lg text-[28px] font-medium tracking-[-0.01em] ${gradeClass(grade)}`}
          >
            {grade}
          </div>
        </Surface>

        <Surface padding="p-6">
          <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted">
            Trend
          </div>
          <div
            className={`mt-2 text-[36px] font-medium tracking-[-0.02em] flex items-center gap-2 ${
              trend.direction === "up"
                ? "text-emerald-600"
                : trend.direction === "down"
                  ? "text-red-600"
                  : "text-ink-muted"
            }`}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
            <span className="text-[22px] font-normal">{trend.change}%</span>
          </div>
        </Surface>
      </div>

      <section>
        <h2 className="text-[14px] font-medium text-ink mb-4">Alla prov</h2>
        <div className="space-y-3">
          {provStats.map((stat) => (
            <Surface key={stat.result.id} padding="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[15px] font-medium text-ink">
                    {stat.provData?.title ?? "Prov"}
                  </div>
                  <div className="text-[13px] text-ink-secondary mt-0.5">
                    {stat.provData?.createdAt
                      ? new Date(stat.provData.createdAt).toLocaleDateString("sv-SE")
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-[14px] text-ink-secondary tabular-nums">
                    {stat.points}/{stat.maxPoints} poäng
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${
                      stat.percentage >= 80
                        ? "bg-emerald-50 text-emerald-700"
                        : stat.percentage >= 50
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {stat.percentage}%
                  </span>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      </section>

      {(analysis.strengths.length > 0 || analysis.weaknesses.length > 0) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {analysis.strengths.length > 0 && (
            <Surface padding="p-5" className="bg-emerald-50/50 border-emerald-100">
              <h3 className="text-[14px] font-medium text-emerald-800 mb-3 flex items-center gap-2">
                <LineIcon name="check" className="h-4 w-4" />
                Styrkor
              </h3>
              <ul className="space-y-2">
                {analysis.strengths.map((s) => (
                  <li key={s.label} className="text-[13px] text-emerald-700">
                    {s.label} ({s.successRate}%)
                  </li>
                ))}
              </ul>
            </Surface>
          )}
          {analysis.weaknesses.length > 0 && (
            <Surface padding="p-5" className="bg-red-50/50 border-red-100">
              <h3 className="text-[14px] font-medium text-red-800 mb-3 flex items-center gap-2">
                <LineIcon name="pen" className="h-4 w-4" />
                Utvecklingsområden
              </h3>
              <ul className="space-y-2">
                {analysis.weaknesses.map((w) => (
                  <li key={w.label} className="text-[13px] text-red-700">
                    {w.label} ({w.successRate}%)
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </section>
      )}
    </div>
  );
}

function percentageToGrade(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  if (percentage >= 50) return "E";
  return "F";
}

function gradeClass(grade: string): string {
  switch (grade) {
    case "A":
    case "B":
      return "bg-emerald-50 text-emerald-700";
    case "C":
    case "D":
      return "bg-amber-50 text-amber-700";
    case "E":
      return "bg-orange-50 text-orange-700";
    default:
      return "bg-red-50 text-red-700";
  }
}
