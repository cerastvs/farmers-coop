import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "./lib/session";
import { canAccess } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;

  const isLoginPage = path.startsWith("/login");
  const isDashboard = path.startsWith("/dashboard");

  const loginUrl = new URL("/login", req.url);
  const dashboardUrl = new URL("/dashboard", req.url);

  if (!session?.userId && !isLoginPage) {
    return NextResponse.redirect(loginUrl);
  }

  if (session?.userId && isLoginPage) {
    return NextResponse.redirect(dashboardUrl);
  }

  if (session?.userId && !canAccess(path, session.userRole)) {
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}
