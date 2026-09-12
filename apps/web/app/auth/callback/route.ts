import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback route – hanterar koden som Supabase skickar tillbaka
 * efter en lyckad Google-inloggning (eller annan OAuth-provider).
 *
 * Supabase SDK:n byter authorization code mot en session via
 * exchangeCodeForSession(), som sätter session-cookies automatiskt.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  // Bakom Railway-proxyn är request.url intern (http://localhost:8080) —
  // bygg origin från forwarded-headers så redirecten går till den publika
  // domänen, aldrig till containerns interna adress.
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.headers.get("host") ??
    "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const origin = isLocal || !host ? requestUrl.origin : `${proto}://${host}`;

  console.log("[auth/callback] Full URL:", request.url);
  console.log("[auth/callback] code present:", !!code);
  console.log("[auth/callback] origin:", origin);

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession FAILED:", {
        message: error.message,
        status: error.status,
        name: error.name,
        cause: error.cause,
        stack: error.stack,
      });
      const errorDesc = encodeURIComponent(error.message);
      return NextResponse.redirect(
        `${origin}/login?error=auth_callback_failed&error_description=${errorDesc}`,
      );
    }

    console.log("[auth/callback] exchangeCodeForSession OK, user:", data.user?.email);
    return NextResponse.redirect(`${origin}${next}`);
  }

  console.error("[auth/callback] No code param in URL. searchParams:", Object.fromEntries(requestUrl.searchParams));
  return NextResponse.redirect(`${origin}/login?error=auth_callback_no_code`);
}
