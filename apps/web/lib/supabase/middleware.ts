import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Uppdaterar Supabase-sessionen (refresh token) på varje request och
 * skyddar sidor som kräver inloggning. Anropas från middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Kanonisera domän: produktionstrafik ska alltid gå via wiseos.noblearc.se.
  // Railway-domänen (wiseos-production.up.railway.app) är samma tjänst men får
  // aldrig bära sessionscookies — bl.a. kan Supabase-OAuth landa där med
  // ?code= om Site URL är felinställd. Vi skickar vidare hela URL:en intakt
  // så auth-callback och sessionsexchange sker på rätt domän.
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.headers.get("host") ??
    "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const canonicalHost = "wiseos.noblearc.se";
  const code = request.nextUrl.searchParams.get("code");
  const onCallback = pathname.startsWith("/auth/callback");

  // Supabase kan leverera auth-koden på roten (om Site URL pekar på
  // domänroten istf /auth/callback). Skicka alltid koden genom callbacken
  // så den växlas till en session — annars tappas den vid /login-redirecten.
  const codeRedirect = (base: URL) => {
    const url = base;
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(code!)}&next=${encodeURIComponent(pathname)}`;
    if (!isLocal) {
      url.host = canonicalHost;
      url.protocol = "https";
      url.port = "";
    }
    return url;
  };

  if (!isLocal && host !== canonicalHost) {
    const url = request.nextUrl.clone();
    url.host = canonicalHost;
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(code && !onCallback ? codeRedirect(url) : url, 308);
  }

  if (code && !onCallback) {
    return NextResponse.redirect(codeRedirect(request.nextUrl.clone()));
  }

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
    pathname.startsWith("/login") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/legal");
  if (!user && !isPublicPath) {
    // request.url är intern bakom proxyn (localhost:8080) — bygg den publika
    // adressen från forwarded-host så redirecten aldrig pekar på containern.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    if (!isLocal) {
      redirectUrl.host = host || canonicalHost;
      redirectUrl.protocol = "https";
      redirectUrl.port = "";
    }
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
