import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-klient (Server Components, Route Handlers, Server Actions).
 * Läser/skriver session via Next.js cookies() enligt Supabase SSR-guiden.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll anropas ibland från en Server Component där cookies inte
            // kan sättas. Ignoreras säkert om middleware sköter sessionsuppdatering.
          }
        },
      },
    },
  );
}
