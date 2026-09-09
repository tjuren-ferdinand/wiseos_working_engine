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
  "transition-[background-color,border-color,box-shadow,transform] duration-200 hover:bg-paper-secondary hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transform-none motion-reduce:transition-none";

export default function Surface({
  children,
  className = "",
  padding = "p-6",
  href,
  interactive,
  onClick,
}: BaseProps & { href?: string; onClick?: () => void }) {
  const classes = `${surfaceBase} ${padding} ${
    interactive || href || onClick ? interactiveBase : ""
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
      <button type="button" onClick={onClick} className={`group block w-full text-left ${classes}`}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
