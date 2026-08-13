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
    <nav className={`flex items-center gap-2 text-[13px] ${className}`}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !last ? (
              <Link href={item.href} className="text-ink-secondary hover:text-ink transition-colors">
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
