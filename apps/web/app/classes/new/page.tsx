"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { actions } from "@/lib/store";
import LevelAutocomplete from "@/components/LevelAutocomplete";

export default function NewKlassPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    subject: "Matematik",
    gradeLevel: "Gymnasiet åk 1",
    gradingParams: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const k = actions.createKlass(form);
    router.push(`/classes/${k.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/classes" className="text-[13px] text-ink-secondary hover:text-ink transition-colors">← Tillbaka</Link>
      <h1 className="mt-5 text-[28px] font-medium tracking-[-0.02em] text-ink">Skapa ny klass</h1>
      <p className="mt-2 text-[15px] text-ink-secondary">En klass samlar prov och har egna rättningsparametrar.</p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-[18px] border border-ink-hairline bg-paper-raised shadow-soft p-7">
        <Field label="Klassens namn" hint="t.ex. NA22B – Fysik 1">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="NA22B – Fysik 1"
            required
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Ämne">
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input">
              <option>Matematik</option>
              <option>Fysik</option>
              <option>Kemi</option>
              <option>Biologi</option>
              <option>Teknik</option>
            </select>
          </Field>
          <Field label="Nivå" hint="Skriv fritt eller välj från fördefinierade alternativ">
            <LevelAutocomplete
              value={form.gradeLevel}
              onChange={(value) => setForm({ ...form, gradeLevel: value })}
              placeholder="t.ex. Gymnasiet åk 2"
            />
          </Field>
        </div>

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

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/classes" className="btn-secondary">Avbryt</Link>
          <button type="submit" className="btn-primary">Skapa klass</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[14px] font-medium text-ink">{label}</div>
      {hint && <div className="mt-0.5 text-[12.5px] text-ink-muted leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
