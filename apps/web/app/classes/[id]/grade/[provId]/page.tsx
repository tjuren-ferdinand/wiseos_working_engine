"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore, deriveStep, actions } from "@/lib/store";
import ProcessingScene from "@/components/ProcessingScene";
import Workbench from "@/components/Workbench";
import LineIcon from "@/components/LineIcon";
import Breadcrumb from "@/components/ui/Breadcrumb";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";

export default function GradePage() {
  const params = useParams<{ id: string; provId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const studentId = search.get("student");

  const klasser = useStore((s) => s.klasser);
  const allProv = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const [hoveredResult, setHoveredResult] = useState<string | null>(null);

  const klass = useMemo(() => klasser.find((k) => k.id === params.id), [klasser, params.id]);
  const prov = useMemo(() => allProv.find((p) => p.id === params.provId), [allProv, params.provId]);
  const allResults = useMemo(() => results.filter((r) => r.provId === params.provId), [results, params.provId]);

  // Hämta scanPages on-demand när Workbench öppnas (listvyn returnerar inte scanPages).
  useEffect(() => {
    if (studentId) {
      const result = allResults.find((r) => r.id === studentId);
      if (result && (!result.scanPages || result.scanPages.length === 0)) {
        void actions.fetchResultDetail(studentId);
      }
    }
  }, [studentId, allResults]);

  if (!klass || !prov) {
    return (
      <EmptyState
        title="Provet kunde inte hittas."
        action={<Link href="/classes" className="btn-secondary">Till klasslistan</Link>}
      />
    );
  }

  // Workbench mode
  if (studentId) {
    const result = allResults.find((r) => r.id === studentId);
    if (!result) return <EmptyState title="Elev saknas." />;
    return (
      <Workbench
        result={result}
        prov={prov}
        klass={klass}
        onBack={() => router.push(`/classes/${klass.id}/grade/${prov.id}`)}
        onPrint={() => window.print()}
      />
    );
  }

  // Processing
  if (prov.status === "grading") {
    return (
      <div className="-mx-5 -mt-6 flex min-h-[calc(100vh-8rem)] items-center justify-center px-5">
        <div className="w-full max-w-2xl">
          <ProcessingScene prov={prov} klass={klass} onBack={() => router.push(`/classes/${klass.id}`)} />
        </div>
      </div>
    );
  }

  // Folder grid
  const answerKeySource =
    allResults.find((r) => r.document?.answerKeySource)?.document?.answerKeySource ??
    (prov.facitMode === "uploaded" ? "uploaded" : prov.facitMode === "ai_generated" ? "generated" : "none");
  const answerKeyLabel = answerKeySource === "inferred_question_sheet"
    ? "AI-infererat från frågeblad"
    : answerKeySource === "uploaded"
      ? "Eget facit"
      : answerKeySource === "generated"
        ? "AI-genererat facit"
        : "Inget facit";
  return (
    <div className="space-y-8 print:hidden">
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: klass.name, href: `/classes/${klass.id}` },
          { label: prov.title },
        ]} />
        <PageHeader
          title={prov.title}
          subtitle={`Klassmapp · ${allResults.filter((r) => r.document?.documentType !== "not_student_submission").length} elever rättade`}
        />
        <div className="flex">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
            answerKeySource === "inferred_question_sheet" || answerKeySource === "generated"
              ? "bg-state-warning/10 text-state-warning ring-state-warning/20"
              : "bg-ink/5 text-ink-secondary ring-ink/10"
          }`}>
            <LineIcon name={answerKeySource === "uploaded" ? "check" : "sparkles"} className="h-3 w-3" />
            Bedömningsunderlag: {answerKeyLabel}
          </span>
        </div>
        {answerKeySource === "inferred_question_sheet" && (
          <div className="flex items-start gap-3 rounded-xl border border-state-warning/25 bg-state-warning/[0.07] px-4 py-3 text-sm">
            <LineIcon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-state-warning" />
            <div>
              <div className="font-medium text-ink">AI-infererat underlag — inte lärarens facit</div>
              <div className="mt-0.5 text-xs text-ink-secondary">WiseOS har tolkat och löst frågebladet automatiskt. Granska underlaget och osäkra resultat extra noggrant.</div>
            </div>
          </div>
        )}
      </div>

      {allResults.length === 0 ? (
        <EmptyState title="Inga resultat ännu." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allResults.map((r) => {
            const total = r.steps.reduce(
              (s, st) => s + deriveStep(st, klass.gradingParams).earnedPoints,
              0,
            );
            const max = r.steps.reduce((s, st) => s + st.maxPoints, 0);
            const pct = max ? total / max : 0;
            const isReference = r.document?.documentType === "not_student_submission";
            const noQuestions = !isReference && r.steps.length === 0 && r.document?.questionsFound === 0;
            const needsAttention =
              isReference ||
              noQuestions ||
              !!r.document?.error ||
              (r.document?.needsReviewCount ?? 0) > 0 ||
              r.steps.some((st) => st.status !== "correct");
            const reviewCount = r.steps.filter((st) => st.status === "needs_review").length;
            const isAmbiguous = r.identificationMethod === "name_field_ambiguous";
            return (
              <div
                key={r.id}
                className="relative"
                onMouseEnter={() => setHoveredResult(r.id)}
                onMouseLeave={() => setHoveredResult(null)}
              >
                <Surface
                  href={`/classes/${klass.id}/grade/${prov.id}?student=${r.id}`}
                  padding="p-5"
                  className="relative !shadow-card"
                >
                  <div className="mb-3 flex min-h-5 justify-end">
                    {needsAttention && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-state-warning bg-state-warning/10 ring-1 ring-state-warning/20 rounded-full px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-state-warning" />
                        Granska
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-full grid place-items-center font-sans text-lg font-medium bg-ink/10 text-ink-secondary">
                      {r.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate text-ink group-hover:text-ink-secondary">
                        {r.studentName}
                      </div>
                      <div className="text-xs text-ink-secondary">
                        {isReference ? "Ej bedömd" : noQuestions ? "Inga uppgifter hittades" : `${r.steps.length} steg`}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-ink-secondary">{isReference ? "Status" : "Poäng"}</span>
                      <span className="font-sans text-sm font-medium tabular-nums text-ink">
                        {isReference ? "Ej bedömd" : noQuestions ? "Granska" : <>{total}<span className="text-ink-muted">/{max}</span></>}
                      </span>
                    </div>
                    {!isReference && !noQuestions && (
                      <div className="h-1.5 rounded-full overflow-hidden bg-paper-secondary">
                        <div
                          className={`h-full transition-all ${
                            pct >= 0.85 ? "bg-state-success"
                            : pct >= 0.5 ? "bg-state-warning"
                            : "bg-state-danger"
                          }`}
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </Surface>

                {/* Snabb-sammanfattning — visas på hover (desktop), klick navigerar direkt på mobil */}
                {hoveredResult === r.id && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 hidden rounded-xl border border-ink-hairline bg-paper-raised p-4 shadow-float sm:block">
                    <div className="text-sm font-medium text-ink">{r.studentName}</div>
                    <div className="mt-1 text-xs text-ink-secondary">
                      {isReference
                        ? "Ej bedömd · Frågeunderlag"
                        : noQuestions
                          ? "Inga uppgifter hittades · Granska"
                          : <>{total}/{max} poäng{pct >= 0.85 ? " · Godkänd" : pct >= 0.5 ? " · Gränsfall" : " · Underkänd"}</>}
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      {reviewCount > 0 && (
                        <div className="flex items-center gap-1.5 text-state-warning">
                          <span className="h-1.5 w-1.5 rounded-full bg-state-warning" />
                          {reviewCount} steg behöver granskas
                        </div>
                      )}
                      {isAmbiguous && (
                        <div className="flex items-center gap-1.5 text-state-danger">
                          <span className="h-1.5 w-1.5 rounded-full bg-state-danger" />
                          Namn-ambiguitet — granska manuellt
                        </div>
                      )}
                      {!needsAttention && !isAmbiguous && (
                        <div className="text-ink-secondary">
                          {r.steps.filter((s) => s.status === "correct").length}/{r.steps.length} steg korrekta
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
