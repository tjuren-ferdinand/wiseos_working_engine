"use client";

import LineIcon from "./LineIcon";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

type RowStatus = "queued" | "ocr" | "grading" | "done" | "error";

type Row = {
  id: string;
  file: File;
  previewUrl: string;
  studentName: string;
  ocrText: string;
  ocrConfidence: number | null;
  score: number | null;
  reviewStatus: string | null;
  status: RowStatus;
  error?: string;
};

function deriveStudentName(filename: string): string {
  // "Anna_Andersson - prov1.jpg" → "Anna Andersson"
  const base = filename.replace(/\.[^.]+$/, "");
  const cleaned = base
    .split(/[-–_]/)[0] // ta del innan första bindestreck/underscore-grupp
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Titlecase
  return cleaned
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// Begränsad parallellitet så vi inte överbelastar Mathpix/Wolfram
const CONCURRENCY = 3;

export default function BulkUploadZone({
  assignmentId,
  onComplete,
}: {
  assignmentId: string;
  onComplete?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(pdf|heic)$/i.test(f.name));
    const newRows: Row[] = arr.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      studentName: deriveStudentName(f.name),
      ocrText: "",
      ocrConfidence: null,
      score: null,
      reviewStatus: null,
      status: "queued",
    }));
    setRows((prev) => [...prev, ...newRows]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function patch(id: string, p: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  async function processOne(row: Row) {
    try {
      patch(row.id, { status: "ocr" });
      const ocr = await api.ocrUpload(row.file);
      patch(row.id, { ocrText: ocr.text, ocrConfidence: ocr.confidence, status: "grading" });

      const res = await api.grade({
        assignment_id: assignmentId,
        student_name: row.studentName || "Okänd elev",
        answer_text: ocr.text,
        ocr_confidence: ocr.confidence,
      });

      patch(row.id, {
        score: res.submission.score,
        reviewStatus: res.submission.review_status,
        status: "done",
      });
    } catch (e) {
      patch(row.id, { status: "error", error: (e as Error).message });
    }
  }

  async function runAll() {
    setRunning(true);
    // Snapshotta köade rader så vi inte processar de som läggs till mitt i körningen
    const queued = rows.filter((r) => r.status === "queued" || r.status === "error");

    // Worker pool med fast concurrency
    let cursor = 0;
    async function worker() {
      while (cursor < queued.length) {
        const idx = cursor++;
        await processOne(queued[idx]);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    setRunning(false);
    onComplete?.();
  }

  const stats = {
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    error: rows.filter((r) => r.status === "error").length,
    pending: rows.filter((r) => r.status === "queued").length,
  };

  return (
    <div className="space-y-3">
      {/* Drop-zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition ${
          dragging ? "border-wise-600 bg-wise-50" : "border-slate-300 bg-white hover:border-wise-400 hover:bg-slate-50"
        }`}
      >
        <div className="mx-auto mb-3 h-11 w-11 rounded-xl bg-wise-50 text-wise-600 grid place-items-center">
          <LineIcon name="stack" className="h-5 w-5" />
        </div>
        <div className="font-semibold text-slate-900">
          Släpp alla prov från klassen här
        </div>
        <div className="text-sm text-slate-500 mt-1">
          Eller klicka för att välja flera filer • PNG, JPG, HEIC, PDF
        </div>
        <div className="text-xs text-slate-400 mt-2">
          💡 Tips: Namnge filerna t.ex. <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Anna_Andersson.jpg</code> så
          fylls elevnamnet automatiskt.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.heic"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Status-rad + Action */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">{stats.total} prov</span>
            {stats.done > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 text-emerald-700">
                <LineIcon name="check" className="h-3.5 w-3.5" /> {stats.done} rättade
              </span>
            )}
            {stats.error > 0 && <span className="ml-3 text-red-700">⚠ {stats.error} fel</span>}
            {stats.pending > 0 && <span className="ml-3 text-amber-700">⏳ {stats.pending} väntar</span>}
          </div>
          <div className="flex gap-2">
            {!running && stats.pending > 0 && (
              <button
                onClick={runAll}
                className="rounded-lg bg-wise-600 px-4 py-2 text-sm font-semibold text-white hover:bg-wise-700 active:scale-[0.98]"
              >
                <span className="inline-flex items-center gap-1.5"><LineIcon name="play" className="h-3.5 w-3.5" /> Rätta alla ({stats.pending})</span>
              </button>
            )}
            {running && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-wise-600 border-t-transparent" />
                Bearbetar…
              </div>
            )}
            {!running && rows.length > 0 && (
              <button
                onClick={() => {
                  rows.forEach((r) => URL.revokeObjectURL(r.previewUrl));
                  setRows([]);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Rensa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rader */}
      <div className="space-y-2">
        {rows.map((r) => (
          <RowCard key={r.id} row={r} onPatch={(p) => patch(r.id, p)} onRemove={() => removeRow(r.id)} disabled={running} />
        ))}
      </div>
    </div>
  );
}

function RowCard({
  row,
  onPatch,
  onRemove,
  disabled,
}: {
  row: Row;
  onPatch: (p: Partial<Row>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const statusInfo: Record<RowStatus, { label: string; cls: string }> = {
    queued: { label: "väntar", cls: "bg-slate-100 text-slate-700" },
    ocr: { label: "läser text…", cls: "bg-blue-100 text-blue-800 animate-pulse" },
    grading: { label: "rättar…", cls: "bg-amber-100 text-amber-800 animate-pulse" },
    done: { label: "klar", cls: "bg-emerald-100 text-emerald-800" },
    error: { label: "fel", cls: "bg-red-100 text-red-800" },
  };
  const info = statusInfo[row.status];

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      {/* Thumbnail */}
      <img
        src={row.previewUrl}
        alt={row.file.name}
        className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-lg object-cover bg-slate-100"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={row.studentName}
            onChange={(e) => onPatch({ studentName: e.target.value })}
            disabled={disabled || row.status === "done"}
            placeholder="Elevens namn"
            className="flex-1 min-w-[140px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium disabled:bg-slate-50"
          />
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.cls}`}>
            {info.label}
          </span>
          {row.status === "done" && row.score != null && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                row.score >= 100 ? "bg-emerald-100 text-emerald-800" : row.score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
              }`}
            >
              {row.score} p
            </span>
          )}
        </div>

        <div className="mt-1 text-xs text-slate-500 truncate" title={row.file.name}>
          {row.file.name}
        </div>

        {row.ocrText && (
          <div className="mt-2 font-mono text-xs text-slate-700 bg-slate-50 rounded px-2 py-1 truncate">
            {row.ocrText}
            {row.ocrConfidence != null && (
              <span className="ml-2 text-slate-400">({Math.round(row.ocrConfidence * 100)}%)</span>
            )}
          </div>
        )}

        {row.error && (
          <div className="mt-2 text-xs text-red-600">⚠ {row.error}</div>
        )}
      </div>

      {!disabled && row.status !== "done" && (
        <button
          onClick={onRemove}
          aria-label="Ta bort"
          className="flex-shrink-0 h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}
