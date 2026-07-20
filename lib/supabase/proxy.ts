import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!configured) return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );
  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims?.sub);
  const publicPath = request.nextUrl.pathname.startsWith("/signin") || request.nextUrl.pathname.startsWith("/auth/") || request.nextUrl.pathname.startsWith("/ilma-logo.png");
  if (!authenticated && !publicPath && !request.nextUrl.pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone(); url.pathname = "/signin"; return NextResponse.redirect(url);
  }
  if (authenticated && request.nextUrl.pathname === "/signin") {
    const url = request.nextUrl.clone(); url.pathname = "/"; return NextResponse.redirect(url);
  }
  return response;
}
