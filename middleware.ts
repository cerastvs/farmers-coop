import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "./lib/session";
import { canAccess } from "./lib/auth";
import { routeAccess } from "./lib/rbac";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;
  const publicRoutes = ["/login", "/signup"];
  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));
  const publicPages = ["/home", "/registration"];
  const isPublicPage = publicPages.some(
    (p) => pathname === p || pathname.startsWith(p),
  );

  if (
    pathname.startsWith("/api") ||
    pathname.includes(".") // Skips public files with extensions
  ) {
    return NextResponse.next();
  }

  if (isPublicPage) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", req.url);
  const dashboardUrl = new URL("/dashboard", req.url);
  if (!session?.userId && !isPublicRoute) {
    return NextResponse.redirect(loginUrl);
  }
  if (session?.userId && isPublicRoute) {
    return NextResponse.redirect(dashboardUrl);
  }
  const match = Object.keys(routeAccess).find(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
  if (match) {
    const allowedRoles = routeAccess[match];
    if (!session?.userRole) {
      return NextResponse.redirect(loginUrl);
    }
    if (!allowedRoles.includes(session.userRole)) {
      return NextResponse.redirect(dashboardUrl);
    }
  }
  return NextResponse.next();
}
