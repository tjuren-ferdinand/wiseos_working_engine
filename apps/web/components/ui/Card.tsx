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
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={`rounded-2xl border border-equi-300/50 bg-equi-50 shadow-card dark:border-equi-800/50 dark:bg-equi-950 ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
