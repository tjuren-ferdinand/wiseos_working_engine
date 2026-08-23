import React from "react";
import LineIcon from "@/components/LineIcon";
import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Något gick fel",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/20">
        <LineIcon name="x" className="h-5 w-5 text-danger" />
      </div>
      <h3 className="mt-4 text-base font-medium text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          Försök igen
        </Button>
      )}
    </div>
  );
}
