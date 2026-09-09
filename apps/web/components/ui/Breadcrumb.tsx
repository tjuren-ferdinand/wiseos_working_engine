import React from "react";
import Link from "next/link";

/**
 * Breadcrumb — quiet contextual navigation. Muted separators, restrained hover.
 */
export default function Breadcrumb({
  items,
  className = "",
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Brödsmulor" className={`flex flex-wrap items-center gap-2 break-words text-[13px] ${className}`}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !last ? (
              <Link href={item.href} className="rounded-sm text-ink-secondary hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-ink" : "text-ink-secondary"}>{item.label}</span>
            )}
            {!last && <span className="text-ink-muted">/</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
