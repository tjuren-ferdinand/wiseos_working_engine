"use client";

import Link from "next/link";
import LineIcon from "./LineIcon";

export default function DashboardEmptyState() {
  return (
    <div className="rounded-2xl border border-ink-hairline/10 bg-paper-raised p-7 shadow-soft sm:p-9">
      <h2 className="text-[18px] font-medium tracking-[-0.015em] text-ink">
        Skapa din första kurs
      </h2>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-secondary">
        Kurser samlar dina klasser, elever och prov. WiseOS hjälper dig rätta snabbare därifrån.
      </p>
      <Link
        href="/courses"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-paper transition-all duration-300 hover:scale-[1.015] hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 active:scale-[0.985]"
      >
        <LineIcon name="graduation-cap" className="h-4 w-4" />
        Skapa kurs
      </Link>
    </div>
  );
}
