"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";

export default function ClassesPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Hantera"
        title="Klasser"
        subtitle="Hantera dina klasser och rättningsparametrar."
        action={
          <Link href="/classes/new" className="btn-primary inline-flex items-center gap-1.5">
            Skapa klass
          </Link>
        }
      />

      {klasser.length === 0 ? (
        <EmptyState
          icon="graduation-cap"
          title="Inga klasser ännu"
          description="Skapa din första klass för att börja rätta."
          action={
            <Link href="/classes/new" className="btn-primary">
              Kom igång
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {klasser.map((k) => {
            const klassProv = prov.filter((p) => p.klassId === k.id);
            const klassResults = results.filter((r) =>
              klassProv.some((p) => p.id === r.provId),
            );
            const kurs = kurser.find((c) => c.id === k.kursId);
            return (
              <Surface key={k.id} href={`/classes/${k.id}`} padding="p-5" className="relative">
                <div className="absolute right-4 top-4 text-ink-muted/50 transition-colors group-hover:text-ink-secondary">
                  <LineIcon name="graduation-cap" className="h-5 w-5" />
                </div>
                <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted">
                  {kurs?.name || "Kurs"} · {k.students.length} elever
                </div>
                <h2 className="mt-1.5 text-[15px] font-medium text-ink">{k.name}</h2>
                {k.gradingParams.customRules.length > 0 && (
                  <div className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed italic text-ink-muted">
                    &ldquo;{k.gradingParams.customRules[0]}&rdquo;
                  </div>
                )}
                <div className="mt-4 flex items-center gap-4 text-[13px] text-ink-secondary">
                  <span className="flex items-center gap-1.5">
                    <LineIcon name="users" className="h-3.5 w-3.5 opacity-70" />
                    {klassResults.length} elever
                  </span>
                  <span>{klassProv.length} prov</span>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
