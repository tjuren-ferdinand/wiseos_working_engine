"use client";

import Link from "next/link";
import LineIcon from "./LineIcon";
import GradingGrid from "./GradingGrid";

export default function DashboardEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-hairline/10 bg-paper-raised p-8 shadow-soft sm:p-10">
      <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-64 text-ink opacity-[0.07] [mask-image:linear-gradient(135deg,black,transparent_72%)]">
        <GradingGrid seed={311} compact />
      </div>
      <div className="relative z-10 max-w-sm">
        <h2 className="text-[20px] font-medium tracking-[-0.015em] text-ink">
          Skapa din första klass
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-secondary">
          Samla elever och prov på ett ställe. WiseOS hjälper dig vidare därifrån.
        </p>

        <Link
          href="/classes/new"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-paper transition-all duration-300 hover:scale-[1.015] hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 active:scale-[0.985]"
        >
          <LineIcon name="users" className="h-4 w-4" />
          Skapa klass
        </Link>
      </div>
    </div>
  );
}
