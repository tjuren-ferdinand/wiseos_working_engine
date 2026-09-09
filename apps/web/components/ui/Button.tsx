import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper enabled:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transform-none motion-reduce:transition-none";

  const variants = {
    primary:
      "bg-ink text-paper enabled:hover:bg-ink/85",
    secondary: "border border-ink-hairline bg-paper-elevated text-ink enabled:hover:bg-paper-secondary",
    ghost:
      "bg-transparent text-ink-secondary enabled:hover:bg-ink/[0.04] enabled:hover:text-ink",
    outline:
      "border border-ink-hairline bg-transparent text-ink enabled:hover:bg-paper-secondary",
  };

  const sizes = {
    sm: "h-10 px-4 text-sm",
    md: "h-12 px-5 text-sm",
    lg: "h-14 px-6 text-base",
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
