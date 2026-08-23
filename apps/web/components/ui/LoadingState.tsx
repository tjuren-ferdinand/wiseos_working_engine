import React from "react";
import LineIcon from "@/components/LineIcon";

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export default function LoadingState({
  title = "Laddar...",
  description,
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-equi-300/50 bg-equi-50 p-8 text-center dark:border-equi-800/50 dark:bg-equi-950">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-equi-300 bg-equi-100 dark:border-equi-700 dark:bg-equi-900">
        <LineIcon name="sparkles" className="h-5 w-5 animate-pulse text-muted" />
      </div>
      <h3 className="mt-4 text-base font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}
