"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";
import Breadcrumb from "@/components/ui/Breadcrumb";

export default function CoursePage() {
  const params = useParams();
  const kursId = params.id as string;

  const kurser = useStore((s) => s.kurser);
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);

  const kurs = kurser.find((k) => k.id === kursId);
  const kursKlasser = klasser.filter((k) => k.kursId === kursId);

  if (!kurs) {
    return <div className="text-ink-secondary">Kursen hittades inte</div>;
  }

  const totalStudents = kursKlasser.reduce((sum, k) => sum + k.students.length, 0);

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumb
          items={[{ label: "Kurser", href: "/courses" }, { label: kurs.name }]}
          className="mb-6"
        />
        <PageHeader
          eyebrow={kurs.code}
          title={kurs.name}
          subtitle={kurs.description}
          action={
            <Link href={`/classes/new?kursId=${kursId}`} className="btn-primary inline-flex items-center gap-1.5">
              Skapa klass
            </Link>
          }
        />

        {/* Stats — integrated row, not boxed widgets */}
        <div className="mt-8 flex items-center gap-12 border-t border-ink-hairline pt-6">
          <div>
            <div className="text-[24px] font-medium tracking-[-0.01em] text-ink tabular-nums">
              {kursKlasser.length}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted">
              {kursKlasser.length === 1 ? "klass" : "klasser"}
            </div>
          </div>
          <div>
            <div className="text-[24px] font-medium tracking-[-0.01em] text-ink tabular-nums">
              {totalStudents}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-muted">elever totalt</div>
          </div>
        </div>
      </div>

      {/* Classes */}
      <section>
        <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
          Klasser som läser {kurs.name}
        </h2>

        {kursKlasser.length === 0 ? (
          <EmptyState
            icon="graduation-cap"
            title="Inga klasser ännu"
            description={`Skapa en klass för ${kurs.name}.`}
            action={
              <Link href={`/classes/new?kursId=${kursId}`} className="btn-primary">
                Skapa klass
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kursKlasser.map((klass) => {
              const klassProv = prov.filter((p) => p.klassId === klass.id);

              return (
                <Surface key={klass.id} href={`/classes/${klass.id}`} padding="p-5" className="relative">
                  <div className="absolute right-4 top-4 text-ink-muted/50 transition-colors group-hover:text-ink-secondary">
                    <LineIcon name="graduation-cap" className="h-5 w-5" />
                  </div>
                  <h3 className="text-[15px] font-medium text-ink">{klass.name}</h3>
                  <div className="mt-3 flex items-center gap-4 text-[13px] text-ink-secondary">
                    <span className="flex items-center gap-1.5">
                      <LineIcon name="users" className="h-3.5 w-3.5 opacity-70" />
                      {klass.students.length} elever
                    </span>
                    <span>{klassProv.length} prov</span>
                  </div>
                  {klassProv.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-ink-hairline">
                      <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                        Senaste prov
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-ink-secondary truncate">
                        {klassProv[klassProv.length - 1].title}
                      </div>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
