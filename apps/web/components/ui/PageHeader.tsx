import React from "react";

/**
 * PageHeader — the single canonical page title block for WiseOS.
 * Establishes one continuous typographic scale across every route so the
 * product feels like one operating system rather than a set of pages.
 *
 *   eyebrow   → 11px uppercase, wide tracking, tertiary ink
 *   title     → 28px medium, tight tracking, primary ink
 *   subtitle  → 15px, secondary ink
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-2.5 break-words text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-secondary max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1.5">{action}</div>}
    </header>
  );
}
