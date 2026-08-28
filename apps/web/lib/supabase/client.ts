"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-klient (client components). Hanterar session i cookies automatiskt
 * via @supabase/ssr så att server- och klient-sidan alltid ser samma session.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
