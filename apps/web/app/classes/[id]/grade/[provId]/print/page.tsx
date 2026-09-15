"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useStore, actions } from "@/lib/store";
import MathText from "@/components/Math";
import "katex/dist/katex.min.css";
import s from "./print.module.css";

export default function PrintPage() {
  const params = useParams<{ id: string; provId: string }>();
  const search = useSearchParams();
  const studentId = search.get("student");

  const klasser = useStore((st) => st.klasser);
  const allProv = useStore((st) => st.prov);
  const results = useStore((st) => st.results);

  const klass = useMemo(
    () => klasser.find((k) => k.id === params.id),
    [klasser, params.id],
  );
  const prov = useMemo(
    () => allProv.find((p) => p.id === params.provId),
    [allProv, params.provId],
  );
  const result = useMemo(
    () => results.find((r) => r.id === studentId),
    [results, studentId],
  );

  // Hämta scanPages on-demand (listvyn returnerar inte scanPages).
  useEffect(() => {
    if (studentId && result && (!result.scanPages || result.scanPages.length === 0)) {
      void actions.fetchResultDetail(studentId);
    }
  }, [studentId, result]);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [result]);

  if (!klass || !prov || !result) {
    return (
      <div className={s.page}>
        <div className={s.missing}>
          Utskrift inte tillgänglig — data saknas.
          <Link
            href={klass ? `/classes/${klass.id}` : "/classes"}
            className={s.missingLink}
          >
            Tillbaka
          </Link>
        </div>
      </div>
    );
  }

  const total = result.steps.reduce((sum, st) => sum + st.earnedPoints, 0);
  const max = result.steps.reduce((sum, st) => sum + st.maxPoints, 0);
  const pct = max ? Math.round((total / max) * 100) : 0;
  const dateStr = new Date(
    result.gradedAt || result.scannedAt,
  ).toLocaleDateString("sv-SE");
  const provDate = new Date(prov.date).toLocaleDateString("sv-SE");

  const statusLabel = (st: string) =>
    st === "correct"
      ? "Korrekt"
      : st === "partial"
        ? "Delvis"
        : st === "incorrect"
          ? "Fel"
          : st === "needs_review"
            ? "Granskas"
            : "Väntar";

  const statusClass = (st: string) =>
    st === "correct"
      ? s.statusCorrect
      : st === "partial"
        ? s.statusPartial
        : st === "incorrect"
          ? s.statusIncorrect
          : st === "needs_review"
            ? s.statusReview
            : s.statusPending;

  const hasScans = (result.scanPages?.length ?? 0) > 0;

  return (
    <div className={s.page}>
      {/* Skärm-knappar (döljs i print) */}
      <div className={s.screenBar}>
        <button
          className={s.screenBtn}
          onClick={() => window.history.back()}
        >
          ← Tillbaka
        </button>
        <button
          className={`${s.screenBtn} ${s.screenBtnPrimary}`}
          onClick={() => window.print()}
        >
          Skriv ut / Spara PDF
        </button>
      </div>

      {/* === Sidhuvud === */}
      <div className={s.headerLabel}>WiseOS · Rättningsgenomgång</div>
      <div className={s.studentName}>{result.studentName}</div>
      <div className={s.meta}>
        {klass.name} · {prov.title} · Provdatum {provDate}
      </div>
      <hr className={s.hairline} />
      <div className={s.scoreBlock}>
        <span className={s.scoreLabel}>Slutpoäng</span>
        <span className={s.scoreValue}>
          {total} / {max} poäng · {pct}%
        </span>
      </div>
      <hr className={s.hairline} />

      {/* === Per uppgift === */}
      {result.steps.map((step, i) => {
        const ann = step.annotation;
        return (
          <div key={step.id} className={s.step}>
            <div className={s.stepHeader}>
              <div className={s.stepLeft}>
                <span className={s.stepNumber}>Uppgift {i + 1}</span>
                <span className={`${s.statusBadge} ${statusClass(step.status)}`}>
                  {statusLabel(step.status)}
                </span>
              </div>
              <span className={s.stepPoints}>
                {step.earnedPoints} / {step.maxPoints} p
              </span>
            </div>

            {step.questionText && (
              <div className={s.stepQuestion}>
                <MathText content={step.questionText} />
              </div>
            )}

            {step.studentWork && (
              <div className={s.field}>
                <div className={s.fieldLabel}>Elevens svar</div>
                <div className={`${s.fieldValue} ${s.fieldMono}`}>
                  <MathText content={step.studentWork} mode="transcription" />
                </div>
              </div>
            )}

            {step.correctAnswer && (
              <div className={s.field}>
                <div className={s.fieldLabel}>Facit</div>
                <div className={s.fieldValue}>
                  <MathText content={step.correctAnswer} mode="transcription" />
                </div>
              </div>
            )}

            {/* AI-analys — omstrukturerad för läsbarhet */}
            {(step.feedback || ann?.summary || ann?.issues?.length || ann?.evidence?.length || ann?.suggestions?.length) && (
              <div className={s.analysis}>
                <div className={s.analysisLabel}>
                  {step.reviewed ? "Bedömning (granskad av lärare)" : "AI-analys"}
                </div>

                {ann?.summary && (
                  <div>
                    <MathText content={ann.summary} />
                  </div>
                )}

                {!ann?.summary && step.feedback && (
                  <div>
                    <MathText content={step.feedback} />
                  </div>
                )}

                {ann?.issues && ann.issues.length > 0 && (
                  <div className={s.analysisSub}>
                    <div className={s.analysisSubLabel}>Förklaring</div>
                    {ann.issues.map((item, j) => (
                      <div key={`is-${j}`}>
                        <MathText content={item} />
                      </div>
                    ))}
                  </div>
                )}

                {ann?.evidence && ann.evidence.length > 0 && (
                  <div className={s.analysisSub}>
                    <div className={s.analysisSubLabel}>Beröm</div>
                    {ann.evidence.map((item, j) => (
                      <div key={`ev-${j}`}>
                        <MathText content={item} />
                      </div>
                    ))}
                  </div>
                )}

                {ann?.suggestions && ann.suggestions.length > 0 && (
                  <div className={s.analysisSub}>
                    <div className={s.analysisSubLabel}>Övningsuppgift</div>
                    {ann.suggestions.map((item, j) => (
                      <div key={`sg-${j}`}>
                        <MathText content={item} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step.teacherNote && (
              <div className={s.analysis}>
                <div className={s.analysisLabel}>Lärarens kommentar</div>
                <MathText content={step.teacherNote} />
              </div>
            )}
          </div>
        );
      })}

      {/* === Originalskanning (sista sidan) === */}
      {hasScans && (
        <div className={s.scanPage}>
          <div className={s.scanTitle}>
            Originaldokument — elevens handskrivna svar
          </div>
          {result.scanPages!.map((src, i) =>
            src.startsWith("data:image") ? (
              <div key={i} className={s.scanItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Sida ${i + 1}`}
                  className={s.scanImg}
                />
                <div className={s.scanCaption}>
                  Sida {i + 1} av {result.scanPages!.length} · {result.studentName}
                </div>
              </div>
            ) : (
              <div key={i} className={s.scanItem}>
                <div className={s.scanCaption}>
                  PDF-originalet finns sparat digitalt i WiseOS.
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* === Sidfot === */}
      <div className={s.footer}>
        Genererad av WiseOS · {dateStr}
      </div>
    </div>
  );
}
