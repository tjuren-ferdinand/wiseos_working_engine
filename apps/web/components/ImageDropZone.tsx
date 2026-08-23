"use client";

import { useCallback, useRef, useState } from "react";
import { api, type OcrResult } from "@/lib/api";

type Props = {
  label?: string;
  hint?: string;
  onResult: (r: OcrResult) => void;
};

export default function ImageDropZone({ label = "Ladda upp bild", hint, onResult }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const r = await api.ocrUpload(file);
      setResult(r);
      onResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-ink-hairline bg-paper-secondary" : "border-ink-hairline bg-paper-secondary hover:border-ink-hairline"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {preview ? (
          <img src={preview} alt="Förhandsvisning" className="mx-auto max-h-48 rounded-lg" />
        ) : (
          <>
            <div className="text-ink font-medium">{label}</div>
            <div className="mt-1 text-xs text-ink-secondary">
              {hint || "Dra-och-släpp eller klicka. PNG/JPG/PDF, max 10 MB."}
            </div>
          </>
        )}
      </div>

      {loading && <div className="mt-2 text-sm text-ink-secondary">Läser handskriven matematik…</div>}
      {error && <div className="mt-2 text-sm text-state-danger">{error}</div>}
      {result && (
        <div className="mt-2 rounded-lg border border-state-success/20 bg-state-success/10 p-3 text-sm">
          <div className="text-xs font-semibold uppercase text-state-success">OCR-resultat</div>
          <div className="mt-1 font-mono text-ink">{result.text}</div>
          <div className="mt-1 text-xs text-ink-secondary">Konfidens: {(result.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
}
