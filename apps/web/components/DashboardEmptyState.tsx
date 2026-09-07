"use client";

import Link from "next/link";
import LineIcon from "./LineIcon";

export default function DashboardEmptyState() {
  return (
    <div className="rounded-[20px] border border-ink-hairline/10 bg-paper-raised p-8 shadow-soft sm:p-10">
      <div className="mx-auto max-w-sm text-center">
        <h2 className="text-[20px] font-medium tracking-[-0.01em] text-ink">
          Välkommen till WiseOS
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
          Börja med att skapa en klass för att samla prov och elever på ett ställe.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-ink-muted">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-hairline/10 bg-paper">
            <LineIcon name="upload" className="h-5 w-5" />
          </div>
          <div className="h-px w-6 bg-ink-hairline/20" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-hairline/10 bg-paper">
            <LineIcon name="sparkles" className="h-5 w-5" />
          </div>
          <div className="h-px w-6 bg-ink-hairline/20" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-hairline/10 bg-paper">
            <LineIcon name="check" className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-8 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          <span className="w-16">Ladda upp</span>
          <span className="w-16">AI rättar</span>
          <span className="w-16">Granska</span>
        </div>

        <Link
          href="/classes/new"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-[14px] font-semibold text-paper transition-all hover:bg-ink/90"
        >
          <LineIcon name="users" className="h-4 w-4" />
          Skapa din första klass
        </Link>
      </div>
    </div>
  );
}
