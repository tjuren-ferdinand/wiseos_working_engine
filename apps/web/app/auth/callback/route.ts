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
  const origin = requestUrl.origin;

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
