"use client";

import type { ReviewLayout } from "@/lib/theme";

/**
 * Liten, statisk miniatyr av hur ResultCard (granskningsvyn) struktureras
 * för respektive layoutval. Renderas som ren markup, inte skärmdump, så den
 * följer alltid aktivt tema/färgschema.
 */
export default function ReviewLayoutPreview({
  layout,
  active,
}: {
  layout: ReviewLayout;
  active?: boolean;
}) {
  return (
    <div
      className={`relative h-[104px] w-full border-b border-ink-hairline p-2.5 transition-colors ${
        active ? "bg-accent-tint" : "bg-paper-secondary"
      }`}
    >
      {layout === "split" && (
        <div className="flex h-full gap-1.5">
          <div className="flex-1 rounded-[6px] border border-ink-hairline/70 bg-paper-raised/80" />
          <div className="flex-1 space-y-1">
            <div className="h-3 rounded-[4px] bg-ink/[0.08]" />
            <div className="h-3 rounded-[4px] bg-ink/[0.08]" />
            <div className="h-3 w-2/3 rounded-[4px] bg-ink/[0.08]" />
          </div>
        </div>
      )}

      {layout === "stacked" && (
        <div className="flex h-full flex-col gap-1.5">
          <div className="h-[42px] rounded-[6px] border border-ink-hairline/70 bg-paper-raised/80" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 rounded-[4px] bg-ink/[0.08]" />
            <div className="h-2.5 rounded-[4px] bg-ink/[0.08]" />
          </div>
        </div>
      )}

      {layout === "compact" && (
        <div className="flex h-full flex-col gap-1">
          <div className="h-2.5 rounded-[4px] bg-ink/[0.08]" />
          <div className="h-2.5 rounded-[4px] bg-ink/[0.08]" />
          <div className="h-2.5 rounded-[4px] bg-ink/[0.08]" />
          <div className="h-2.5 w-3/4 rounded-[4px] bg-ink/[0.08]" />
        </div>
      )}
    </div>
  );
}
