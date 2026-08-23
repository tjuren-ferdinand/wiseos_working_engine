import React from "react";

/**
 * StatusBadge — restrained status indicator. Uses muted semantic tints via the
 * shared token system; never loud pills. A small live dot animates for active
 * states (grading/review).
 */
type Status = "draft" | "grading" | "review" | "published";

const MAP: Record<Status, { label: string; className: string; live?: boolean }> = {
  draft: {
    label: "Utkast",
    className: "text-ink-muted bg-ink/[0.04] border-ink-hairline",
  },
  grading: {
    label: "Rättar",
    className: "text-ink-secondary bg-ink/[0.05] border-ink-hairline",
    live: true,
  },
  review: {
    label: "Granskning",
    className: "text-ink bg-accent/15 border-accent/30",
    live: true,
  },
  published: {
    label: "Publicerad",
    className: "text-ink bg-state-success/10 border-state-success/20",
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = MAP[(status as Status)] || MAP.draft;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.className}`}
    >
      {s.live && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {s.label}
    </span>
  );
}
