"use client";

import { useTheme } from "@/lib/theme";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";

export default function Logo({
  className,
  alt = "WiseOS",
}: {
  className?: string;
  alt?: string;
}) {
  const { theme } = useTheme();
  const src = theme === "dark" ? LOGO_MARK_DARK : LOGO_MARK_LIGHT;

  return <img src={src} alt={alt} className={className} />;
}
