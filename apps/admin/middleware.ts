import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSessionToken } from "./lib/session";
import { resolveActiveAdminSession } from "./lib/admin-session";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

function isPublicAsset(pathname: string) {
  return pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const parsedSession = await parseAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  const session = await resolveActiveAdminSession(parsedSession);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (parsedSession && !session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ADMIN_SESSION_COOKIE);
    return response;
  }

  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (parsedSession && !session && isPublicPath) {
    const response = NextResponse.next();
    response.cookies.delete(ADMIN_SESSION_COOKIE);
    return response;
  }

  if (session && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session && session.role !== "admin" && pathname.startsWith("/users")) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
