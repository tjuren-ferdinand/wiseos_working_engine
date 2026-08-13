import React from "react";
import Link from "next/link";

/**
 * Surface — the canonical elevated panel/card for WiseOS.
 * A quiet raised graphite surface with a hairline border and extremely soft
 * shadow. When `href` is provided it renders an interactive navigable card
 * with a restrained hover lift.
 */
type BaseProps = {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  interactive?: boolean;
};

const surfaceBase =
  "rounded-[16px] bg-paper-raised border border-ink-hairline shadow-soft";
const interactiveBase =
  "transition-all duration-200 hover:border-ink-hairline hover:bg-paper-secondary hover:-translate-y-0.5 hover:shadow-card";

export default function Surface({
  children,
  className = "",
  padding = "p-6",
  href,
  interactive,
  onClick,
}: BaseProps & { href?: string; onClick?: () => void }) {
  const classes = `${surfaceBase} ${padding} ${
    interactive || href ? interactiveBase : ""
  } ${className}`;

  if (href) {
    return (
      <Link href={href} className={`group block ${classes}`}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={`group block w-full text-left ${classes}`}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
