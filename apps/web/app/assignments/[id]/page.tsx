"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Assignment, type Submission, type ReviewStatus } from "@/lib/api";
import ImageDropZone from "@/components/ImageDropZone";
import BulkUploadZone from "@/components/BulkUploadZone";

export default function AssignmentDetailPage({ params }: { params: { id: string } }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [answer, setAnswer] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState("");
  const [editScore, setEditScore] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      const [a, subs] = await Promise.all([
        api.getAssignment(params.id),
        api.listResults(params.id),
      ]);
      setAssignment(a);
      setSubmissions(subs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [params.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function grade(e: any) {
    e.preventDefault();
    if (!studentName || !answer) return;
    setGrading(true);
    setError(null);
    try {
      const res = await api.grade({
        assignment_id: params.id,
        student_name: studentName,
        answer_text: answer,
        ocr_confidence: ocrConfidence,
      });
      setLastFeedback(res.feedback);
      setAnswer("");
      setOcrConfidence(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  }

  if (error && !assignment) return <div className="text-red-600">Fel: {error}</div>;
  if (!assignment) return <div className="text-slate-500">Laddar…</div>;

  const correct = submissions.filter((s) => s.score >= 100).length;
  const avg = submissions.length
    ? Math.round(submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{assignment.subject}</div>
        <h1 className="text-2xl font-bold text-slate-900">{assignment.title}</h1>
        {assignment.problem_text && <p className="mt-2 text-slate-700">{assignment.problem_text}</p>}
        <div className="mt-2 text-sm text-slate-500">
          Korrekt svar: <span className="font-mono text-slate-800">{assignment.correct_answer}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Inlämningar" value={String(submissions.length)} />
        <Stat label="Korrekta" value={`${correct} / ${submissions.length || 0}`} />
        <Stat label="Snittpoäng" value={`${avg}`} />
      </div>

      <section className="rounded-2xl border-2 border-wise-200 bg-gradient-to-br from-wise-50 to-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">📚 Rätta hela klassen</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Skanna in alla prov på en gång – wiseOS OCR:ar och Wolfram-verifierar var och en.
            </p>
          </div>
          <span className="rounded-full bg-wise-600 text-white px-3 py-1 text-xs font-bold">REKOMMENDERAT</span>
        </div>
        <BulkUploadZone assignmentId={params.id} onComplete={refresh} />
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 group">
        <summary className="cursor-pointer font-semibold text-slate-700 hover:text-wise-700 select-none flex items-center gap-2">
          <span className="text-slate-400 group-open:rotate-90 transition-transform">▶</span>
          Eller rätta ett enskilt svar manuellt
        </summary>

        <div className="mt-4 mb-4">
          <ImageDropZone
            label="Släpp foto av elevens lösning"
            hint="Mathpix läser handskriften och fyller i svaret automatiskt"
            onResult={(r) => { setAnswer(r.text); setOcrConfidence(r.confidence); }}
          />
        </div>

        <form onSubmit={grade} className="grid gap-3 sm:grid-cols-[1fr,2fr,auto]">
          <input
            value={studentName}
            onChange={(e: any) => setStudentName(e.target.value)}
            placeholder="Elevens namn"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={answer}
            onChange={(e: any) => setAnswer(e.target.value)}
            placeholder="Svar (t.ex. x = 2)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          />
          <button
            disabled={grading}
            className="rounded-lg bg-wise-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-wise-700 disabled:opacity-50 active:scale-[0.98] sm:py-2"
          >
            {grading ? "Rättar…" : "Rätta"}
          </button>
        </form>
        {lastFeedback && (
          <div className="mt-4 rounded-lg bg-wise-50 border border-wise-100 p-4 text-sm text-slate-800">
            <div className="text-xs font-semibold uppercase text-wise-700 mb-1">AI-feedback</div>
            {lastFeedback}
          </div>
        )}
      </details>

      <section>
        <h2 className="font-semibold text-slate-900 mb-3">Inlämningar</h2>
        <div className="space-y-2">
          {submissions.length === 0 && <div className="text-sm text-slate-500">Inga inlämningar ännu.</div>}
          {submissions.map((s) => {
            const isReviewing = reviewing === s.id;
            const displayScore = s.final_score ?? s.score;
            const displayFeedback = s.final_feedback ?? s.ai_feedback;
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-slate-900">{s.student_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{s.answer_text}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReviewBadge status={s.review_status} />
                    {s.confidence_overall != null && (
                      <ConfidenceBadge value={s.confidence_overall} />
                    )}
                    <ScorePill score={displayScore} />
                  </div>
                </div>

                {displayFeedback && (
                  <div className="mt-3 text-sm text-slate-700">{displayFeedback}</div>
                )}

                {s.requires_review && !isReviewing && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => {
                        await api.review(s.id, { action: "approve", reviewed_by: "lärare" });
                        await refresh();
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      ✓ Godkänn
                    </button>
                    <button
                      onClick={() => {
                        setReviewing(s.id);
                        setEditFeedback(s.ai_feedback || "");
                        setEditScore(s.score);
                      }}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      ✎ Redigera
                    </button>
                    <button
                      onClick={async () => {
                        await api.review(s.id, { action: "reject", reviewed_by: "lärare" });
                        await refresh();
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      ✕ Avvisa
                    </button>
                  </div>
                )}

                {isReviewing && (
                  <div className="mt-3 space-y-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <div className="text-xs font-semibold uppercase text-amber-800">Lärargranskning</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editScore}
                      onChange={(e: any) => setEditScore(parseInt(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <textarea
                      value={editFeedback}
                      onChange={(e: any) => setEditFeedback(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await api.review(s.id, {
                            action: "edit",
                            reviewed_by: "lärare",
                            final_feedback: editFeedback,
                            final_score: editScore,
                          });
                          setReviewing(null);
                          await refresh();
                        }}
                        className="rounded-lg bg-wise-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-wise-700"
                      >
                        Spara & skicka till elev
                      </button>
                      <button
                        onClick={() => setReviewing(null)}
                        className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReviewBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, { label: string; cls: string }> = {
    auto_approved: { label: "🟢 Auto-godkänd", cls: "bg-emerald-100 text-emerald-800" },
    pending_review: { label: "🟡 Väntar granskning", cls: "bg-amber-100 text-amber-800" },
    approved: { label: "✓ Godkänd", cls: "bg-blue-100 text-blue-800" },
    edited: { label: "✎ Redigerad", cls: "bg-purple-100 text-purple-800" },
    rejected: { label: "✕ Avvisad", cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls = value >= 0.95 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-mono ${cls}`} title="Aggregerad konfidens (OCR × Wolfram)">
      {pct}%
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 100 ? "bg-emerald-100 text-emerald-800" : score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{score} p</span>;
}
