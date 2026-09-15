"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore, deriveStep, actions, type StudentResult } from "@/lib/store";
import { api } from "@/lib/api";
import ProcessingScene from "@/components/ProcessingScene";
import Workbench, { PremiseModal } from "@/components/Workbench";
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
  const [menuFor, setMenuFor] = useState<{ id: string; x: number; y: number } | null>(null);
  const [premisesFor, setPremisesFor] = useState<StudentResult | null>(null);
  const [regradingIds, setRegradingIds] = useState<Set<string>>(new Set());
  const [confirmRegradeAll, setConfirmRegradeAll] = useState(false);
  const [regradingAll, setRegradingAll] = useState(false);
  const [regradeNotice, setRegradeNotice] = useState<string | null>(null);
  const [liveBatch, setLiveBatch] = useState<{ running: boolean; total: number; done: number; active: string[] } | null>(null);

  const regradeOne = async (resultId: string, instructions?: string) => {
    setMenuFor(null);
    setRegradingIds((s) => new Set(s).add(resultId));
    setRegradeNotice(null);
    try {
      await actions.regradeResult(resultId, instructions);
    } catch (e) {
      setRegradeNotice(`Om-rättning misslyckades: ${(e as Error).message}`);
    } finally {
      setRegradingIds((s) => { const n = new Set(s); n.delete(resultId); return n; });
    }
  };

  const regradeAll = async () => {
    setConfirmRegradeAll(false);
    setRegradingAll(true);
    setRegradeNotice(null);
    try {
      const out = await actions.regradeProv(params.provId);
      setRegradeNotice(`Om-rättning klar: ${out.regraded} elever rättade om${out.skipped ? `, ${out.skipped} hoppades över` : ""}.`);
    } catch (e) {
      setRegradeNotice(`Om-rättning misslyckades: ${(e as Error).message}`);
    } finally {
      setRegradingAll(false);
    }
  };

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

  // Live-läge: om en batch-rättning pågår för det här provet poll-ar vi
  // status + resultat så att elevkorten ploppar in i realtid. Eleverna
  // persisteras per styck i backenden.
  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    const tick = async () => {
      try {
        const status = await api.getBatchStatus(params.provId);
        if (cancelled) return;
        if (!status.running) {
          setLiveBatch(null);
          if (status.done > 0) await actions.refreshProvResults(params.provId);
          if (interval !== undefined) {
            window.clearInterval(interval);
            interval = undefined;
          }
          return;
        }
        setLiveBatch(status);
        await actions.refreshProvResults(params.provId);
        if (interval === undefined) {
          interval = window.setInterval(() => void tick(), 2500);
        }
      } catch {
        // Endpointen kan saknas på äldre backend — då lever sidan som vanligt.
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.provId]);

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
        allResults={allResults.filter((r) => r.document?.documentType !== "not_student_submission")}
        onNavigate={(id) => router.push(`/classes/${klass.id}/grade/${prov.id}?student=${id}`)}
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
            answerKeySource === "inferred_question_sheet" || answerKeySource === "generated"
              ? "bg-state-warning/10 text-state-warning ring-state-warning/20"
              : "bg-ink/5 text-ink-secondary ring-ink/10"
          }`}>
            <LineIcon name={answerKeySource === "uploaded" ? "check" : "sparkles"} className="h-3 w-3" />
            Bedömningsunderlag: {answerKeyLabel}
          </span>
          {allResults.length > 0 && (
            <button
              onClick={() => setConfirmRegradeAll(true)}
              disabled={regradingAll}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              {regradingAll ? "Rättar om…" : "Rätta om provet"}
            </button>
          )}
        </div>
        {liveBatch && (
          <div className="flex items-center gap-3 rounded-xl border border-ink-hairline bg-paper-raised px-4 py-3 text-sm shadow-soft">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/50 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ink/50" />
            </span>
            <span className="font-medium text-ink">WiseOS rättar</span>
            <span className="text-ink-secondary tabular-nums">
              {liveBatch.done} av {liveBatch.total || "?"} klara
            </span>
            {liveBatch.active.length > 0 && (
              <span className="hidden truncate text-xs text-ink-muted sm:inline">
                · {liveBatch.active.join(", ")}
              </span>
            )}
            <span className="ml-auto text-xs text-ink-muted">Klicka på en färdig elev för att börja granska</span>
          </div>
        )}
        {regradeNotice && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            regradeNotice.startsWith("Om-rättning klar")
              ? "border-state-success/25 bg-state-success/[0.07] text-ink"
              : "border-state-danger/30 bg-state-danger/10 text-state-danger"
          }`}>
            {regradeNotice}
          </div>
        )}
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenuFor({ id: r.id, x: e.clientX, y: e.clientY });
                }}
              >
                <Surface
                  href={`/classes/${klass.id}/grade/${prov.id}?student=${r.id}`}
                  padding="p-5"
                  className="relative !shadow-card"
                >
                  <div className="mb-3 flex min-h-5 items-start justify-between">
                    {!isReference && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setMenuFor({ id: r.id, x: rect.left, y: rect.bottom + 4 });
                        }}
                        className="rounded-md px-1.5 py-0.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
                        aria-label={`Alternativ för ${r.studentName}`}
                        disabled={regradingIds.has(r.id)}
                      >
                        {regradingIds.has(r.id) ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                        ) : "⋯"}
                      </button>
                    )}
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
          {liveBatch &&
            Array.from({
              length: Math.max(
                0,
                liveBatch.total -
                  allResults.filter((r) => r.document?.documentType !== "not_student_submission").length,
              ),
            }).map((_, i) => (
              <div
                key={`pending-${i}`}
                className="rounded-2xl border border-dashed border-ink-hairline bg-paper-raised/50 p-5 animate-pulse"
              >
                <div className="mb-3 flex min-h-5 items-start">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/15 border-t-ink/50" />
                </div>
                <div className="h-4 w-2/3 rounded bg-ink/[0.06]" />
                <div className="mt-2 h-3 w-1/2 rounded bg-ink/[0.05]" />
                <div className="mt-4 text-[11px] text-ink-muted">Rättas…</div>
              </div>
            ))}
        </div>
      )}

      {/* Elev-meny — öppnas via ⋯ eller högerklick på elevkortet */}
      {menuFor && (() => {
        const target = allResults.find((r) => r.id === menuFor.id);
        if (!target) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} onContextMenu={(e) => { e.preventDefault(); setMenuFor(null); }} />
            <div
              className="fixed z-50 w-56 rounded-xl border border-ink-hairline bg-paper-raised shadow-float p-1.5"
              style={{ left: Math.min(menuFor.x, window.innerWidth - 240), top: menuFor.y }}
            >
              <div className="px-3 py-1.5 text-[11px] font-medium text-ink-muted truncate">{target.studentName}</div>
              <button
                onClick={() => void regradeOne(target.id)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
              >
                Rätta om eleven
              </button>
              <button
                onClick={() => { setMenuFor(null); setPremisesFor(target); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
              >
                AI-premisser för eleven
              </button>
              <button
                onClick={() => { setMenuFor(null); router.push(`/classes/${klass.id}/grade/${prov.id}?student=${target.id}`); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
              >
                Öppna granskning
              </button>
            </div>
          </>
        );
      })()}

      {premisesFor && (
        <PremiseModal
          result={premisesFor}
          onClose={() => setPremisesFor(null)}
          onRegrade={(text) => void regradeOne(premisesFor.id, text)}
        />
      )}

      {confirmRegradeAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setConfirmRegradeAll(false)}>
          <div className="w-full max-w-md rounded-2xl bg-paper-raised p-6 shadow-float space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-medium text-ink">Rätta om hela provet?</h3>
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              Alla {allResults.filter((r) => r.document?.documentType !== "not_student_submission").length} elever rättas om mot sparat facit —
              ett AI-anrop per elev. <strong className="text-ink">Manuella poängändringar och godkännanden nollställs.</strong>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRegradeAll(false)} className="btn-secondary">Avbryt</button>
              <button onClick={() => void regradeAll()} className="btn-primary">Rätta om alla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
