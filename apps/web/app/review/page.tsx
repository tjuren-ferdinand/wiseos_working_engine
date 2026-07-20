"use client";

import ReviewWorkbench from "@/components/ReviewWorkbench";
import { useTheme } from "@/lib/theme";

export default function ReviewPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="space-y-12">
      <section className="pt-4">
        <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
          Granskning
        </p>
        <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
          Granska
          <br />
          <span className={isDark ? "text-white/40" : "text-slate-400"}>rättningar</span>
        </h1>
        <p className={`mt-6 text-lg leading-relaxed max-w-lg ${isDark ? "text-white/50" : "text-slate-500"}`}>
          Granska och publicera AI-rättade prov till dina elever.
        </p>
      </section>
      
      <ReviewWorkbench />
    </div>
  );
}
