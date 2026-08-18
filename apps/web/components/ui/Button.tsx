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
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-ink text-equi-50 hover:bg-ink/90 dark:bg-equi-100 dark:text-ink dark:hover:bg-equi-200",
    secondary: "bg-equi-100 text-ink hover:bg-equi-200 dark:bg-equi-800 dark:hover:bg-equi-700",
    ghost:
      "bg-transparent text-muted hover:bg-equi-100 hover:text-ink dark:hover:bg-equi-900",
    outline:
      "border border-equi-300 bg-transparent text-ink hover:bg-equi-100 dark:border-equi-700 dark:hover:bg-equi-900",
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
