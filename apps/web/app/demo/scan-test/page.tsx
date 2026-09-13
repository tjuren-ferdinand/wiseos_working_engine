"use client";

// TEMPORÄR TESTSIDA för skanner-verifiering (tas bort efter test).
// Renderar DocumentScanner standalone med instrumentering som en
// headless browser kan läsa via window.__scanTest.

import { useCallback, useEffect, useState } from "react";
import DocumentScanner from "@/components/DocumentScanner";

declare global {
  interface Window {
    __scanTest?: {
      closes: number;
      dones: number;
      doneFiles: string[];
      mounts: number;
      renders: number;
    };
  }
}

export default function ScanTestPage() {
  const [open, setOpen] = useState(true);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    window.__scanTest = { closes: 0, dones: 0, doneFiles: [], mounts: 1, renders: 0 };
  }, []);

  useEffect(() => {
    if (window.__scanTest) window.__scanTest.renders += 1;
  });

  const handleClose = useCallback(() => {
    if (window.__scanTest) window.__scanTest.closes += 1;
    console.log("[scantest] onClose invoked");
    setOpen(false);
  }, []);

  const handleDone = useCallback((files: File[]) => {
    if (window.__scanTest) {
      window.__scanTest.dones += 1;
      window.__scanTest.doneFiles = files.map((f) => f.name);
    }
    console.log("[scantest] onDone invoked:", files.map((f) => f.name).join(","));
    setFileCount(files.length);
    setOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-paper p-4">
      <h1 className="text-lg font-semibold">Scanner-test</h1>
      <p className="text-sm text-ink-muted">
        open={String(open)} files={fileCount}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg bg-ink px-4 py-2 text-sm text-paper"
      >
        Öppna skanner
      </button>
      <DocumentScanner open={open} onClose={handleClose} onDone={handleDone} />
    </div>
  );
}
