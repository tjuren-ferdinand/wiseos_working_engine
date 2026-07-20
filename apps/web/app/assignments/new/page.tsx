"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import ImageDropZone from "@/components/ImageDropZone";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subject: "Matematik",
    grade_level: "Gy 1",
    problem_text: "",
    correct_answer: "",
  });

  const update = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: any) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const a = await api.createAssignment(form);
      router.push(`/assignments/${a.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Ny uppgift</h1>
      <p className="text-slate-500 mb-5 sm:mb-6 text-sm">Skapa en uppgift som elever kan lämna in svar på.</p>

      <div className="mb-5 sm:mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Snabbstart från bild (valfritt)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Fota uppgiften – wiseOS läser texten med Mathpix och fyller i fälten åt dig.
        </p>
        <ImageDropZone
          label="Släpp uppgiftsbild här"
          hint="OCR fyller automatiskt i 'Uppgiftstext' nedan"
          onResult={(r) => setForm((f) => ({ ...f, problem_text: r.text }))}
        />
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <Field label="Titel">
          <input required value={form.title} onChange={update("title")} className={inp} placeholder="Andragradsekvation – vecka 12" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ämne">
            <select value={form.subject} onChange={update("subject")} className={inp}>
              <option>Matematik</option>
              <option>Fysik</option>
              <option>Kemi</option>
            </select>
          </Field>
          <Field label="Årskurs">
            <select value={form.grade_level} onChange={update("grade_level")} className={inp}>
              <option>Åk 7</option><option>Åk 8</option><option>Åk 9</option>
              <option>Gy 1</option><option>Gy 2</option><option>Gy 3</option>
            </select>
          </Field>
        </div>

        <Field label="Uppgiftstext">
          <textarea value={form.problem_text} onChange={update("problem_text")} rows={4} className={inp} placeholder="Lös ekvationen 2x + 3 = 7" />
        </Field>

        <Field label="Korrekt svar">
          <input required value={form.correct_answer} onChange={update("correct_answer")} className={`${inp} font-mono`} placeholder="x = 2" />
        </Field>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button disabled={loading} className="w-full sm:w-auto rounded-lg bg-wise-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-wise-700 disabled:opacity-50 active:scale-[0.98]">
          {loading ? "Skapar…" : "Skapa uppgift"}
        </button>
      </form>
    </div>
  );
}

const inp = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-wise-500 focus:outline-none focus:ring-2 focus:ring-wise-500/30";

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
