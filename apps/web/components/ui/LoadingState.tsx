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
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-ink-hairline bg-paper-raised p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-ink-hairline bg-paper-secondary">
        <LineIcon name="sparkles" className="h-5 w-5 animate-pulse motion-reduce:animate-none text-ink-secondary" />
      </div>
      <h3 className="mt-4 text-base font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
