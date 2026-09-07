import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Card({
  children,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const paddings = {
    none: "",
    sm: "p-3.5",
    md: "p-4",
    lg: "p-5",
  };

  return (
    <div
      className={`rounded-2xl border border-ink-hairline bg-paper-raised text-ink shadow-card ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
