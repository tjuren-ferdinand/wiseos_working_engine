"use client";

import { usePathname } from "next/navigation";

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <main
      className={
        isLogin
          ? "flex min-h-screen w-full flex-col pt-16 pb-28"
          : "mx-auto min-h-screen w-full max-w-5xl px-5 pt-24 pb-28"
      }
    >
      {children}
    </main>
  );
}
