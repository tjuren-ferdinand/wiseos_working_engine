import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Uppdaterar Supabase-sessionen (refresh token) på varje request och
 * skyddar sidor som kräver inloggning. Anropas från middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Låt /auth/callback passera utan att middleware rör cookies/session —
  // Route Handlern sköter exchangeCodeForSession() själv och middleware:ns
  // getUser()-anrop kan störa PKCE code_verifier-cookien.
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Uppdaterar/refreshar sessionen så cookien alltid är färsk.
  const { data: { user } } = await supabase.auth.getUser();

  // Route-skydd: oautentiserade besökare skickas till /login, som nu
  // fungerar som appens publika landningssida (hero + inloggning/signup).
  // /demo är publikt — visar produkten med exempeldata för besökare.
  const isPublicPath =
    pathname.startsWith("/login") || pathname.startsWith("/demo");
  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
