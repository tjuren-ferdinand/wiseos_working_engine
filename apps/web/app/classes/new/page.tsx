"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { actions, useStore } from "@/lib/store";
import CourseCombobox from "@/components/CourseCombobox";

export default function NewKlassPage() {
  return (
    <Suspense>
      <NewKlassForm />
    </Suspense>
  );
}

function NewKlassForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kurser = useStore((s) => s.kurser);
  const [form, setForm] = useState({
    name: "",
    gradingParams: "",
    kursId: searchParams?.get("kursId") || kurser[0]?.id || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKurs = useMemo(
    () => kurser.find((k) => k.id === form.kursId),
    [kurser, form.kursId]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.kursId.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const k = await actions.createKlass({
        name: form.name,
        kursId: form.kursId,
        gradingParams: form.gradingParams,
      });
      router.push(`/classes/${k.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/classes" className="text-[13px] text-ink-secondary hover:text-ink transition-colors">← Tillbaka</Link>
      <h1 className="mt-5 text-[28px] font-medium tracking-[-0.02em] text-ink">Skapa ny klass</h1>
      <p className="mt-2 text-[15px] text-ink-secondary">En klass samlar prov och har egna rättningsparametrar.</p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-[18px] border border-ink-hairline bg-paper-raised shadow-soft p-7">
        <Field label="Klassens namn" hint="t.ex. NA22B eller TE12">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="NA22B – Fysik 1"
            required
          />
        </Field>

        <Field label="Kurs" hint="Sök eller skriv t.ex. Fysik 1, Programmering 1, Matematik 4">
          <CourseCombobox
            value={form.kursId}
            onSelect={(kursId) => setForm({ ...form, kursId })}
            placeholder="Sök kurs..."
          />
        </Field>

        {selectedKurs && (
          <div className="flex flex-wrap items-center gap-2 -mt-2">
            <span className="text-[12.5px] text-ink-muted">Vald kurs:</span>
            <span className="inline-flex items-center rounded-full border border-ink-hairline/10 bg-paper px-3 py-1 text-[12.5px] font-medium text-ink">
              {selectedKurs.name}
            </span>
            <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-[12px] text-ink-secondary">
              {selectedKurs.subject}
            </span>
            {selectedKurs.level && (
              <span className="inline-flex items-center rounded-full bg-ink/5 px-3 py-1 text-[12px] text-ink-secondary">
                {selectedKurs.level}
              </span>
            )}
          </div>
        )}

        <Field
          label="Permanenta rättningsparametrar & noteringar"
          hint="Skickas alltid med när AI:n rättar prov i denna klass. Exempel: ”Gör 0.25 poängs avdrag om enhet saknas”, ”Var extra noggrann med gällande siffror”."
        >
          <textarea
            value={form.gradingParams}
            onChange={(e) => setForm({ ...form, gradingParams: e.target.value })}
            className="input min-h-[120px] font-mono text-[13px] leading-relaxed"
            placeholder="Gör alltid 0.25 poängs avdrag om enhet saknas. Var extra noggrann med gällande siffror. Acceptera alternativa lösningsmetoder om resonemanget håller."
          />
        </Field>

        {error && <p className="text-[13px] text-state-danger">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/classes" className="btn-secondary">Avbryt</Link>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? "Skapar…" : "Skapa klass"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block h-full flex flex-col">
      <div className="text-[14px] font-medium text-ink">{label}</div>
      {hint && <div className="mt-0.5 text-[12.5px] text-ink-muted leading-relaxed">{hint}</div>}
      <div className="mt-auto pt-2">{children}</div>
    </label>
  );
}
