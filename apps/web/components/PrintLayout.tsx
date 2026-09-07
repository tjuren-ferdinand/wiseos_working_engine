"use client";

import { type Klass, type Prov, type StudentResult } from "@/lib/store";

/**
 * Print-only layout. Visas bara via @media print.
 * Innehåller: omslag · steg-för-steg-genomgång · originalsidor · vattenstämpel.
 */
export default function PrintLayout({
  klass,
  prov,
  result,
}: {
  klass: Klass;
  prov: Prov;
  result: StudentResult;
}) {
  const total = result.steps.reduce((s, st) => s + st.earnedPoints, 0);
  const max = result.steps.reduce((s, st) => s + st.maxPoints, 0);
  const percentage = max ? Math.round((total / max) * 100) : 0;
  const correctCount = result.steps.filter((s) => s.status === "correct").length;
  const partialCount = result.steps.filter((s) => s.status === "partial").length;
  const incorrectCount = result.steps.filter((s) => s.status === "incorrect").length;
  const dateStr = new Date(result.gradedAt || result.scannedAt).toLocaleDateString("sv-SE");
  const statusLabel = (s: string) =>
    s === "correct" ? "Korrekt" : s === "partial" ? "Delvis korrekt" : s === "incorrect" ? "Inkorrekt" : "Väntande";

  return (
    <div className="print-doc">
      {/* === Sida 1: Omslag === */}
      <section className="print-page">
        <div className="print-cover">
          <div className="print-cover-label">Rättningsgenomgång · WiseOS</div>
          <h1 className="print-cover-title">{prov.title}</h1>
          <div className="print-cover-meta">
            {klass.name} · Provdatum {new Date(prov.date).toLocaleDateString("sv-SE")}
          </div>
          <div className="print-cover-student">{result.studentName}</div>

          <div className="print-score-block">
            <div className="print-score-label">Slutpoäng</div>
            <div className="print-score-value">
              {total} <span className="print-score-max">/ {max}</span>
              <span className="print-score-pct"> · {percentage}%</span>
            </div>
          </div>

          <div className="print-stats">
            <div className="print-stat">
              <div className="print-stat-value print-stat-correct">{correctCount}</div>
              <div className="print-stat-label">Korrekta</div>
            </div>
            <div className="print-stat">
              <div className="print-stat-value print-stat-partial">{partialCount}</div>
              <div className="print-stat-label">Delvis</div>
            </div>
            <div className="print-stat">
              <div className="print-stat-value print-stat-incorrect">{incorrectCount}</div>
              <div className="print-stat-label">Fel</div>
            </div>
            <div className="print-stat">
              <div className="print-stat-value">{result.steps.length}</div>
              <div className="print-stat-label">Uppgifter</div>
            </div>
          </div>

          <div className="print-cover-signoff">
            Rättad av wiseOS · {dateStr}
          </div>
        </div>
        <PrintFooter />
      </section>

      {/* === Originalsidor === */}
      {(result.scanPages?.length ?? 0) > 0 && (
        <section className="print-page">
          <h2 className="print-h2">Originaldokument – elevens handskrivna svar</h2>
          {result.scanPages!.map((src, i) => (
            <div key={i} className="print-scan-page">
              <div className="print-scan-header">
                <span>Sida {i + 1} av {result.scanPages!.length}</span>
                <span>ORIGINAL · {result.studentName}</span>
              </div>
              {src.startsWith("data:image") ? (
                <img src={src} alt={`Sida ${i + 1}`} className="print-scan" />
              ) : (
                <div>PDF-originalet finns sparat digitalt i WiseOS.</div>
              )}
            </div>
          ))}
          <PrintFooter />
        </section>
      )}

      {/* === Sida 2+: Stegvis genomgång === */}
      <section className="print-page">
        <h2 className="print-h2">Stegvis genomgång</h2>
        <ol className="print-steps">
          {result.steps.map((step) => (
            <li key={step.id} className={`print-step print-step-${step.status}`}>
              <div className="print-step-head">
                <span className="print-step-label">{step.label}</span>
                <span className={`print-step-status print-status-${step.status}`}>
                  {statusLabel(step.status)}
                </span>
                <span className="print-step-points">{step.earnedPoints} / {step.maxPoints} p</span>
              </div>
              {step.studentWork && (
                <div className="print-step-row">
                  <span className="print-step-tag">Elev:</span>
                  <span className="print-step-answer">{step.studentWork}</span>
                </div>
              )}
              {step.correctAnswer && (
                <div className="print-step-row">
                  <span className="print-step-tag">Facit:</span>
                  <span className="print-step-answer print-step-facit">{step.correctAnswer}</span>
                </div>
              )}
              {step.feedback && (
                <div className="print-step-feedback">
                  <span className="print-step-tag">AI-feedback:</span> {step.feedback}
                </div>
              )}
            </li>
          ))}
        </ol>
        <PrintFooter />
      </section>

    </div>
  );
}

function PrintFooter() {
  return (
    <div className="print-footer">
      Rättades med stöd av wiseOS · Certifierad AI-Granskning
    </div>
  );
}
