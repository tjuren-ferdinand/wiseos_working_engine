import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-2xl border border-equi-300 bg-equi-50 px-4 py-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-equi-300 dark:border-equi-700 dark:bg-equi-950 dark:focus:ring-equi-700 ${className}`}
      {...props}
    />
  );
}
