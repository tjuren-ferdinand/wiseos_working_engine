import React from "react";
import LineIcon from "@/components/LineIcon";

/**
 * EmptyState — a calm, monochrome empty state. No dashed borders, no colored
 * icon chips. Just a quiet raised surface, a muted glyph, and clear guidance.
 */
export default function EmptyState({
  icon = "file",
  title,
  description,
  action,
}: {
  icon?: React.ComponentProps<typeof LineIcon>["name"];
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] bg-paper-raised border border-ink-hairline px-8 py-16 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px] bg-ink/[0.04] border border-ink-hairline">
        <LineIcon name={icon} className="h-5 w-5 text-ink-muted" />
      </div>
      <h3 className="mt-5 text-[16px] font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
