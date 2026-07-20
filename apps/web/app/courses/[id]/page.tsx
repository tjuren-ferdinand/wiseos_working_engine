"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useParams } from "next/navigation";

export default function CoursePage() {
  const params = useParams();
  const kursId = params.id as string;
  
  const kurser = useStore((s) => s.kurser);
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const kurs = kurser.find((k) => k.id === kursId);
  const kursKlasser = klasser.filter((k) => k.kursId === kursId);

  if (!kurs) {
    return <div className={isDark ? "text-white" : "text-slate-900"}>Kursen hittades inte</div>;
  }

  return (
    <div className="space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link 
          href="/courses" 
          className={`hover:underline ${isDark ? "text-white/60" : "text-slate-500"}`}
        >
          Kurser
        </Link>
        <span className={isDark ? "text-white/40" : "text-slate-400"}>/</span>
        <span className={isDark ? "text-white" : "text-slate-900"}>{kurs.name}</span>
      </nav>

      {/* Header */}
      <section className="pt-4">
        <div>
          <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
            {kurs.code}
          </p>
          <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
            {kurs.name}
          </h1>
          <p className={`mt-4 text-lg ${isDark ? "text-white/60" : "text-slate-600"}`}>
            {kurs.description}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-8 flex items-center gap-8">
          <div>
            <div className={`text-3xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {kursKlasser.length}
            </div>
            <div className={`text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
              {kursKlasser.length === 1 ? "Klass" : "Klasser"}
            </div>
          </div>
          <div>
            <div className={`text-3xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {kursKlasser.reduce((sum, k) => sum + k.students.length, 0)}
            </div>
            <div className={`text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
              Elever totalt
            </div>
          </div>
        </div>
      </section>

      {/* Classes Grid */}
      <section>
        <h2 className={`mb-6 text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          Klasser som läser {kurs.name}
        </h2>
        
        {kursKlasser.length === 0 ? (
          <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${
            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
          }`}>
            <div className={`mx-auto h-14 w-14 rounded-2xl grid place-items-center ${
              isDark ? "bg-[#e8b0e4]/10" : "bg-[#e8b0e4]/15"
            }`}>
              <LineIcon name="graduation-cap" className={`h-7 w-7 ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`} />
            </div>
            <h3 className={`mt-5 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              Inga klasser ännu
            </h3>
            <p className={`mt-2 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
              Skapa en klass för {kurs.name}.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kursKlasser.map((klass) => {
              const klassProv = prov.filter((p) => p.klassId === klass.id);
              
              return (
                <Link
                  key={klass.id}
                  href={`/classes/${klass.id}`}
                  className={`group relative rounded-2xl p-6 transition-all hover:-translate-y-0.5 ${
                    isDark
                      ? "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                      : "bg-white border border-slate-200/60 shadow-soft hover:shadow-card"
                  }`}
                >
                  <div className={`absolute right-5 top-5 transition-colors ${
                    isDark ? "text-white/20 group-hover:text-[#e8b0e4]" : "text-slate-200 group-hover:text-[#c78bbf]"
                  }`}>
                    <LineIcon name="graduation-cap" className="h-6 w-6" />
                  </div>
                  
                  <div className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {klass.name}
                  </div>
                  
                  <div className={`mt-4 flex items-center gap-4 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
                    <span className="flex items-center gap-1.5">
                      <LineIcon name="users" className="h-4 w-4" />
                      {klass.students.length} elever
                    </span>
                    <span>
                      {klassProv.length} prov
                    </span>
                  </div>
                  
                  {klassProv.length > 0 && (
                    <div className={`mt-4 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                      <div className={`text-xs ${isDark ? "text-white/40" : "text-slate-400"}`}>
                        Senaste prov
                      </div>
                      <div className={`mt-1 text-sm font-medium ${isDark ? "text-white/80" : "text-slate-700"}`}>
                        {klassProv[klassProv.length - 1].title}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
