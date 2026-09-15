"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  actions,
  type StudentResult,
  type Prov,
  type Klass,
  type Step,
} from "@/lib/store";
import LineIcon from "./LineIcon";
import MathText from "./Math";
import Breadcrumb from "./ui/Breadcrumb";
import EmptyState from "./ui/EmptyState";
import PageHeader from "./ui/PageHeader";
import Surface from "./ui/Surface";
import "katex/dist/katex.min.css";

type Props = {
  result: StudentResult;
  prov: Prov;
  klass: Klass;
  onBack: () => void;
  onPrint: () => void;
  /** Ordnad lista över elevresultat i provet — för föregående/nästa-navigering. */
  allResults?: StudentResult[];
  onNavigate?: (resultId: string) => void;
};

/** Rubrik som förklarar VARFÖR en uppgift behöver granskas. Ren presentation
 *  av backendens data – ingen text hittas på och inget resultat maskeras. */
function reviewReason(step: Step): string | null {
  if (step.error) return `Tekniskt fel vid rättning: ${step.error}`;
  if (step.found === false) {
    return "Uppgiften hittades inte i det uppladdade dokumentet. Kontrollera att alla sidor är med.";
  }
  if (step.status !== "needs_review") return null;
  if (
    typeof step.transcriptionConfidence === "number" &&
    step.transcriptionConfidence < 0.55 &&
    step.studentWork
  ) {
    return `AI:n är osäker på handstilen (${Math.round(
      step.transcriptionConfidence * 100,
    )}% säkerhet). Kontrollera transkriptionen mot originalet.`;
  }
  return "AI:n har otillräckligt underlag för en säker bedömning.";
}

export default function Workbench({ result, prov, klass, onBack, onPrint, allResults, onNavigate }: Props) {
  const router = useRouter();
  const [regrading, setRegrading] = useState(false);
  const [regradeError, setRegradeError] = useState<string | null>(null);
  const [showPremises, setShowPremises] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Beräkna total från V2 Step structure
  const total = result.steps.reduce((s, st) => s + st.earnedPoints, 0);
  const max = result.steps.reduce((s, st) => s + st.maxPoints, 0);
  const reviewable = result.steps.filter((s) => !s.error && s.found !== false);
  const reviewedCount = reviewable.filter((s) => s.reviewed).length;

  const ordered = allResults ?? [result];
  const idx = ordered.findIndex((r) => r.id === result.id);
  const prevResult = idx > 0 ? ordered[idx - 1] : null;
  const nextResult = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const handlePrint = () => {
    router.push(`/classes/${klass.id}/grade/${prov.id}/print?student=${result.id}`);
  };

  const approveAll = () => {
    const now = new Date().toISOString();
    for (const step of reviewable) {
      if (!step.reviewed) {
        actions.updateStep(result.id, step.id, { reviewed: true, reviewedAt: now });
      }
    }
  };

  const handleRegrade = async (instructions?: string) => {
    setRegrading(true);
    setRegradeError(null);
    setMenuOpen(false);
    try {
      await actions.regradeResult(result.id, instructions ?? result.customInstructions);
    } catch (e) {
      setRegradeError((e as Error).message);
    } finally {
      setRegrading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-tertiary">← Översikt</button>
            {onNavigate && (prevResult || nextResult) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => prevResult && onNavigate(prevResult.id)}
                  disabled={!prevResult}
                  className="btn-tertiary disabled:opacity-40"
                  title={prevResult ? `Föregående: ${prevResult.studentName}` : "Ingen föregående elev"}
                >
                  ←
                </button>
                <span className="text-xs text-ink-muted tabular-nums px-1">
                  {idx + 1}/{ordered.length}
                </span>
                <button
                  onClick={() => nextResult && onNavigate(nextResult.id)}
                  disabled={!nextResult}
                  className="btn-tertiary disabled:opacity-40"
                  title={nextResult ? `Nästa: ${nextResult.studentName}` : "Ingen nästa elev"}
                >
                  →
                </button>
              </div>
            )}
            <button
              onClick={() => router.push(`/classes/${klass.id}`)}
              className="btn-tertiary"
            >
              Till klassmapp
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="btn-secondary"
            >
              <span className="sm:hidden">Skriv ut</span>
              <span className="hidden sm:inline">Skriv ut genomgång + Original-PDF</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="btn-secondary"
                aria-label="Fler alternativ"
                disabled={regrading}
              >
                ⋯
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-ink-hairline bg-paper-raised shadow-float p-1.5">
                    <button
                      onClick={() => void handleRegrade()}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
                    >
                      Rätta om eleven
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setShowPremises(true); }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
                    >
                      AI-premisser för eleven
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      <Surface className="space-y-4 !shadow-card">
        <Breadcrumb items={[
          { label: klass.name, href: `/classes/${klass.id}` },
          { label: prov.title, href: `/classes/${klass.id}/grade/${prov.id}` },
          { label: result.studentName },
        ]} className="flex-wrap" />
        <PageHeader
          title={result.studentName}
          action={<ScoreBadge total={total} max={max} notAssessed={result.document?.documentType === "not_student_submission"} />}
          className="flex-wrap"
        />
        {reviewable.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-ink-hairline pt-3">
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 w-28 rounded-full overflow-hidden bg-paper-secondary">
                <div
                  className="h-full bg-state-success transition-all"
                  style={{ width: `${(reviewedCount / reviewable.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-ink-secondary tabular-nums">
                {reviewedCount} av {reviewable.length} granskade
              </span>
            </div>
            {reviewedCount < reviewable.length && (
              <button onClick={approveAll} className="btn-secondary text-xs !px-3 !py-1.5">
                Godkänn alla steg
              </button>
            )}
          </div>
        )}
      </Surface>

      {regrading && (
        <div className="rounded-xl border border-ink-hairline bg-paper-secondary px-5 py-4 flex items-center gap-3 text-sm text-ink-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          Rättar om eleven mot sparat facit…
        </div>
      )}
      {regradeError && (
        <div className="rounded-xl border border-state-danger/30 bg-state-danger/10 px-5 py-4 text-sm text-state-danger">
          Om-rättningen misslyckades: {regradeError}
        </div>
      )}
      {showPremises && (
        <PremiseModal
          result={result}
          onClose={() => setShowPremises(false)}
          onRegrade={(text) => void handleRegrade(text)}
        />
      )}

      <AssessmentBasisBanner meta={result.document} facitMode={prov.facitMode} />
      <DocumentTypeBanner meta={result.document} />

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* Vänster: skannat original */}
        <ScanPanel
          pages={result.scanPages || []}
        />

        {/* Höger: AI-annotationer per steg */}
        <div className="space-y-3">
          {result.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              resultId={result.id}
            />
          ))}
          <ClassParamsSummary klass={klass} prov={prov} />
        </div>
      </div>
      </div>
    </>
  );
}

function AssessmentBasisBanner({ meta, facitMode }: { meta: StudentResult["document"]; facitMode: Prov["facitMode"] }) {
  const source = meta?.answerKeySource ?? (facitMode === "uploaded" ? "uploaded" : facitMode === "ai_generated" ? "generated" : "none");
  if (!source || source === "none") return null;
  const inferred = source === "inferred_question_sheet";
  const label = source === "uploaded"
    ? "Bedömningsunderlag: Eget facit"
    : source === "generated"
      ? "Bedömningsunderlag: AI-genererat facit"
      : "AI-infererat underlag — inte lärarens facit";
  return (
    <div className={`rounded-xl px-5 py-4 flex items-start gap-3.5 ${
      inferred
        ? "border border-state-warning/25 bg-state-warning/[0.07]"
        : "border border-ink-hairline bg-paper-secondary"
    }`}>
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
        inferred ? "bg-state-warning/15 text-state-warning" : "bg-ink/5 text-ink-secondary"
      }`}>
        <LineIcon name={source === "uploaded" ? "check" : "sparkles"} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {inferred && (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
            WiseOS har tolkat och löst frågebladet automatiskt. Kontrollera underlaget och osäkra bedömningar innan publicering.
          </p>
        )}
      </div>
    </div>
  );
}

/** Lugn men tydlig markering när sidklassificeringen bedömer att dokumentet
 *  inte är en elevinlämning (blankett/facit) eller inte kunde bekräftas.
 *  Renderas aldrig för normala inlämningar. */
function DocumentTypeBanner({ meta }: { meta: StudentResult["document"] }) {
  const kind = meta?.documentType;
  const hasAnalysisError = !!meta?.error;
  if (kind !== "not_student_submission" && kind !== "unverified" && !hasAnalysisError) return null;

  const isFlagged = kind === "not_student_submission";
  const isUnverified = kind === "unverified";
  return (
    <div className="rounded-xl border border-state-warning/25 bg-state-warning/[0.07] px-5 py-4 flex items-start gap-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-state-warning/15 text-state-warning">
        <LineIcon name="file" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">
          {isFlagged
            ? "Detta är ett frågeunderlag — inte en elevinlämning"
            : isUnverified
              ? "Dokumentet kunde inte bekräftas som elevinlämning"
              : "Rättningen behöver granskas"}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
          {isFlagged
            ? `${meta?.classificationReason || "Inget elevarbete hittades på sidorna."} Ingen uppgift har bedömts.`
            : isUnverified
              ? "Rättningen kördes, men sidorna kunde inte klassificeras. Granska originalen till vänster innan du godkänner."
              : meta?.error || "Inga uppgifter kunde kopplas till elevdokumentet."}
        </p>
      </div>
    </div>
  );
}

function ScoreBadge({ total, max, notAssessed = false }: { total: number; max: number; notAssessed?: boolean }) {
  const pct = max ? total / max : 0;
  if (notAssessed) {
    return (
      <div className="rounded-2xl border border-ink-hairline shadow-card px-5 py-3 bg-paper-elevated text-ink">
        <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">Status</div>
        <div className="mt-0.5 font-sans text-base font-medium text-state-warning">Ej bedömd</div>
      </div>
    );
  }
  const scoreColor = pct >= 0.85 ? "text-state-success"
    : pct >= 0.5 ? "text-state-warning"
    : "text-state-danger";
  return (
    <div className={`rounded-2xl border border-ink-hairline shadow-card px-5 py-3 bg-paper-elevated text-ink`}>
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">Slutpoäng</div>
      <div className={`mt-0.5 font-sans text-2xl font-medium tabular-nums ${scoreColor}`}>
        {total}<span className={`text-base text-ink-muted`}> / {max}</span>
      </div>
    </div>
  );
}

function ScanPanel({ pages }: { pages: string[] }) {
  const totalPages = pages.length;
  return (
    <Surface padding="p-0" className="overflow-hidden !shadow-card">
      <div className="px-5 py-3 flex items-center justify-between gap-3 bg-paper-secondary">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-secondary">Originaldokument · skannat</div>
        <div className="text-xs text-ink-muted">{totalPages} {totalPages === 1 ? "sida" : "sidor"}</div>
      </div>
      <div className="p-4 space-y-4">
        {pages.length === 0 ? (
          <EmptyState
            title="Originaldokumentet saknas."
            description="Resultatet måste granskas mot den ursprungliga filen."
          />
        ) : (
          pages.map((src, i) => {
            if (src.startsWith("data:image") || src.startsWith("/") || src.startsWith("http")) {
              return (
                <div key={i} className="relative rounded-2xl overflow-hidden shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Sida ${i + 1}`} className="w-full" />
                  <div className="absolute top-2 right-2 text-[10px] font-sans tabular-nums bg-ink/80 text-paper px-2 py-0.5 rounded">
                    sida {i + 1}
                  </div>
                </div>
              );
            }
            if (src.startsWith("data:application/pdf")) {
              return (
                <object
                  key={i}
                  data={src}
                  type="application/pdf"
                  aria-label={`Originaldokument sida ${i + 1}`}
                  className="h-[70vh] w-full rounded-2xl bg-paper-raised shadow-card"
                >
                  <a href={src} download={`original-sida-${i + 1}.pdf`} className="text-sm underline">
                    Öppna originalets PDF-sida
                  </a>
                </object>
              );
            }
            return (
              <div key={i} className="rounded-2xl border border-state-danger/30 bg-state-danger/10 p-6 text-sm text-state-danger">
                Originalformatet kan inte visas. Ladda ner eller öppna källfilen separat.
              </div>
            );
          })
        )}
      </div>
    </Surface>
  );
}

function StepCard({
  step,
  resultId,
}: {
  step: Step;
  resultId: string;
}) {
  const [editing, setEditing] = useState(false);

  const status = step.status;
  const ringMap: Record<Step["status"], string> = {
    correct: "ring-state-success/30",
    partial: "ring-state-warning/30",
    incorrect: "ring-state-danger/30",
    needs_review: "ring-state-warning/30",
    pending: "ring-ink-hairline",
  };

  const verdictColor = status === "correct"
    ? "text-state-success"
    : status === "partial"
    ? "text-state-warning"
    : status === "incorrect"
    ? "text-state-danger"
    : status === "needs_review"
    ? "text-state-warning"
    : "text-ink-secondary";

  const reason = reviewReason(step);
  const annotation = step.annotation;
  const hasAnnotation = !!(
    annotation?.summary ||
    annotation?.evidence?.length ||
    annotation?.issues?.length ||
    annotation?.suggestions?.length
  );

  const canApprove = !step.error && step.found !== false;

  const approve = () => {
    // Godkänn = "jag står bakom bedömningen". Rör aldrig status/poäng.
    actions.updateStep(resultId, step.id, {
      reviewed: !step.reviewed,
      reviewedAt: step.reviewed ? undefined : new Date().toISOString(),
    });
  };

  const reset = () => {
    // Återställ till AI:s originalbedömning — bara när en överstyrning finns.
    if (step.aiEarnedPoints === undefined) return;
    actions.updateStep(resultId, step.id, {
      earnedPoints: step.aiEarnedPoints,
      status: step.aiStatus ?? "needs_review",
      aiEarnedPoints: undefined,
      aiStatus: undefined,
      reviewed: false,
      reviewedAt: undefined,
    });
  };

  return (
    <div
      className={`rounded-[16px] bg-paper-raised shadow-card ring-1 ${ringMap[status]} p-5 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className={`text-[11px] uppercase tracking-wider font-semibold ${
              "text-ink-muted"
            }`}
          >
            {step.label}
          </div>
          <div className={`mt-1 text-sm font-medium ${verdictColor}`}>
            <span className="inline-flex items-center gap-1.5">
              {status === "correct" && (
                <LineIcon name="check" className="h-3.5 w-3.5" />
              )}
              {status === "correct"
                ? "Korrekt"
                : status === "partial"
                ? "Delvis korrekt"
                : status === "incorrect"
                ? "Inkorrekt"
                : status === "needs_review"
                ? "Behöver granskas"
                : "Väntande"}
            </span>
            {step.reviewed && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-state-success/10 px-2 py-0.5 text-[10px] font-medium text-state-success ring-1 ring-state-success/20">
                <LineIcon name="check" className="h-3 w-3" />
                Granskad
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-xs uppercase tracking-wider ${
              "text-ink-muted"
            }`}
          >
            Poäng
          </div>
          <div
            className="font-sans text-lg font-medium tabular-nums text-ink"
          >
            {step.earnedPoints}
            <span
              className="text-ink-muted"
            >
              /{step.maxPoints}
            </span>
          </div>
        </div>
      </div>

      {/* Elevens svar */}
      <div
        className="mt-3 rounded-xl p-3 text-xs leading-relaxed font-mono bg-paper-secondary text-ink"
      >
        <span
          className="text-ink-secondary"
        >
          Elev:
        </span>{" "}
        {step.studentWork ? (
          <span className="block overflow-x-auto"><MathText content={step.studentWork} mode="transcription" /></span>
        ) : (
          <span
            className="text-ink-muted italic"
          >
            {step.found === false
              ? "Uppgiften hittades inte i dokumentet."
              : "Eleven lämnade uppgiften obesvarad."}
          </span>
        )}
      </div>

      {/* Varför uppgiften behöver granskas – visas bara när det faktiskt gäller */}
      {reason && (
        <div
          className="mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed bg-state-warning/10 ring-state-warning/30 text-ink"
        >
          <span className="font-semibold mr-1">Behöver granskas:</span>
          {reason}
        </div>
      )}

      {/* AI-annotation – strukturerad data från backend, aldrig genererad här */}
      {hasAnnotation && (
        <div
          className="mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed bg-ink/5 ring-ink/15 text-ink"
        >
          <span
            className={`inline-flex items-center gap-1 font-semibold mb-1 align-[-2px] ${
              "text-ink"
            }`}
          >
            <LineIcon name="pen" className="h-3.5 w-3.5" />
            AI-annotation
          </span>

          {annotation?.summary && <p className="mt-1"><MathText content={annotation.summary} /></p>}

          {annotation?.evidence?.length ? (
            <ul className="mt-1.5 space-y-0.5">
              {annotation.evidence.map((item, i) => (
                <li key={`ev-${i}`} className="flex gap-1.5">
                  <span className={"text-state-success"}>✓</span>
                  <span><MathText content={item} /></span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.issues?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.issues.map((item, i) => (
                <li key={`is-${i}`} className="flex gap-1.5">
                  <span className={"text-state-danger"}>✗</span>
                  <span><MathText content={item} /></span>
                </li>
              ))}
            </ul>
          ) : null}

          {annotation?.suggestions?.length ? (
            <ul className="mt-1 space-y-0.5">
              {annotation.suggestions.map((item, i) => (
                <li key={`sg-${i}`} className="flex gap-1.5">
                  <span className={"text-state-warning"}>→</span>
                  <span><MathText content={item} /></span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {step.mathVerification && step.mathVerification.status !== "not_applicable" && (
        <div className="mt-2 rounded-xl border border-ink-hairline bg-paper-secondary/50 p-3 text-xs leading-relaxed text-ink-secondary">
          <span className="font-semibold text-ink">Matematisk verifiering:</span>{" "}
          <MathText content={step.mathVerification.message} />
          <span className="ml-2 text-ink-muted">
            {step.mathVerification.provider === "wolfram" ? "Wolfram" : "Lokal kontroll"}
            {step.mathVerification.confidence > 0
              ? ` · ${Math.round(step.mathVerification.confidence * 100)}%`
              : ""}
          </span>
        </div>
      )}

      {/* Feedback till eleven */}
      {step.feedback && (
        <div
          className="mt-2 rounded-xl p-3 text-xs leading-relaxed bg-paper-secondary text-ink"
        >
          <span className="font-semibold mr-1">Feedback:</span>
          <MathText content={step.feedback} />
        </div>
      )}

      {/* Lärarens egen kommentar */}
      {step.teacherNote && (
        <div className="mt-2 rounded-xl ring-1 p-3 text-xs leading-relaxed bg-ink/5 ring-ink/15 text-ink">
          <span className="font-semibold mr-1">Lärarens kommentar:</span>
          {step.teacherNote}
        </div>
      )}

      {editing && (
        <EditStep
          step={step}
          resultId={resultId}
          onDone={() => setEditing(false)}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step.reviewed ? (
          <ActionBtn
            variant="ghost"
            onClick={approve}
          >
            <LineIcon name="check" className="h-3.5 w-3.5 text-state-success" />
            Granskad — ångra
          </ActionBtn>
        ) : (
          <ActionBtn
            variant="primary"
            onClick={approve}
            disabled={!canApprove}
          >
            Godkänn
          </ActionBtn>
        )}
        {!canApprove && !step.reviewed && (
          <span className="text-[11px] text-ink-muted">Går ej att godkänna — anpassa eller granska mot originalet</span>
        )}
        <ActionBtn
          variant="secondary"
          onClick={() => setEditing(true)}
        >
          Anpassa
        </ActionBtn>
        {step.aiEarnedPoints !== undefined && (
          <ActionBtn
            variant="ghost"
            onClick={reset}
          >
            Återställ till AI-förslag
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

function deriveStatus(points: number, maxPoints: number): Step["status"] {
  if (points <= 0) return "incorrect";
  if (points >= maxPoints) return "correct";
  return "partial";
}

const STATUS_LABEL: Record<Step["status"], string> = {
  correct: "Korrekt",
  partial: "Delvis korrekt",
  incorrect: "Inkorrekt",
  needs_review: "Behöver granskas",
  pending: "Väntande",
};

function EditStep({
  step, resultId, onDone,
}: {
  step: Step;
  resultId: string;
  onDone: () => void;
}) {
  const [raw, setRaw] = useState(String(step.earnedPoints));
  const [feedback, setFeedback] = useState(step.feedback ?? "");
  const [note, setNote] = useState(step.teacherNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const pts = Number(raw);
  const valid = raw.trim() !== "" && !Number.isNaN(pts) && pts >= 0 && pts <= step.maxPoints;
  const newStatus = valid ? deriveStatus(pts, step.maxPoints) : null;

  const save = () => {
    if (!valid) {
      setError(`Ange en poäng mellan 0 och ${step.maxPoints}.`);
      return;
    }
    actions.updateStep(resultId, step.id, {
      earnedPoints: pts,
      status: newStatus!,
      feedback: feedback || undefined,
      teacherNote: note.trim() || undefined,
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      // Snapshot av AI-originalet vid första överstyrningen — möjliggör Återställ.
      aiEarnedPoints: step.aiEarnedPoints ?? step.earnedPoints,
      aiStatus: step.aiStatus ?? step.status,
    });
    onDone();
  };

  return (
    <div className="mt-4 rounded-xl p-4 space-y-3 bg-paper-secondary">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-ink-secondary">Poäng:</span>
        <input
          type="number"
          step={0.25}
          min={0}
          max={step.maxPoints}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setError(null); }}
          className="input w-24 font-sans tabular-nums"
        />
        <span className="text-xs text-ink-muted">/ {step.maxPoints}</span>
        {newStatus && (
          <span className="text-xs text-ink-secondary">
            → <span className="font-medium text-ink">{STATUS_LABEL[newStatus]}</span>
          </span>
        )}
      </div>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div>
        <label className="text-xs font-medium text-ink-secondary block mb-1">Feedback till eleven</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="input w-full text-xs leading-relaxed"
          placeholder="Feedback som visas för eleven…"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-secondary block mb-1">Lärarens kommentar (valfri)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="input w-full text-xs leading-relaxed"
          placeholder="T.ex. varför du ändrade bedömningen…"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="btn-secondary">Avbryt</button>
        <button onClick={save} disabled={!valid} className="btn-primary disabled:opacity-50">
          Spara ändring
        </button>
      </div>
    </div>
  );
}

function ActionBtn({
  variant, children, onClick, disabled,
}: {
  variant: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const cls = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-tertiary",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function ClassParamsSummary({ klass, prov }: { klass: Klass; prov: Prov }) {
  const hasCustomRules = klass.gradingParams?.customRules?.length > 0;
  if (!hasCustomRules && !prov.customParams) return null;
  
  return (
    <Surface padding="p-4" className="!shadow-card text-xs leading-relaxed text-ink-secondary">
      <div className="font-medium mb-2 text-ink">Rättningsparametrar</div>
      {hasCustomRules && (
        <div className="mb-1">
          <span className={"text-ink-muted"}>Klassregler:</span>
          <ul className="mt-1 space-y-1 pl-3">
            {klass.gradingParams.customRules.map((rule, i) => (
              <li key={i} className="italic">· {rule}</li>
            ))}
          </ul>
        </div>
      )}
      {prov.customParams && (
        <div><span className={"text-ink-muted"}>Provet:</span> <span className="italic">{prov.customParams}</span></div>
      )}
    </Surface>
  );
}

/** Elevspecifika AI-premisser — sparas på resultatet och läggs till i
 *  grading_notes vid om-rättning av just denna elev. */
export function PremiseModal({
  result,
  onClose,
  onRegrade,
}: {
  result: StudentResult;
  onClose: () => void;
  onRegrade: (instructions: string) => void;
}) {
  const [text, setText] = useState(result.customInstructions ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await actions.setCustomInstructions(result.id, text.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-paper-raised p-6 shadow-float space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-medium text-ink">AI-premisser för {result.studentName}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
            Instruktioner som gäller bara den här eleven vid om-rättning —
            t.ex. <em>&ldquo;eleven skriver x² som x2 — acceptera notationen&rdquo;</em> eller
            <em> &ldquo;eleven får använda avrundning till två decimaler&rdquo;</em>.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          className="input w-full text-sm leading-relaxed"
          placeholder="Premisser för just denna elev…"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Avbryt</button>
          <button onClick={() => void save()} disabled={saving} className="btn-secondary disabled:opacity-50">
            Spara
          </button>
          <button
            onClick={() => { onRegrade(text.trim()); onClose(); }}
            className="btn-primary"
          >
            Spara & rätta om
          </button>
        </div>
      </div>
    </div>
  );
}
