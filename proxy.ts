import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED_PREFIXES = [
  "/admin",
  "/patient-actors",
  "/submissions",
];

const PROTECTED_EXACT = new Set(["/"]);

function isProtected(pathname: string): boolean {
  if (PROTECTED_EXACT.has(pathname)) return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (sessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals, API routes, and static assets. Auth routes
  // (/api/auth/*) must be reachable without a session cookie.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
