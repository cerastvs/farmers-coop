import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decrypt } from "./lib/session";
import { routeAccess } from "./lib/rbac";

const publicRoutes = ["/login", "/signup", "/home"];
const memberServiceRoutes = [
  "/dashboard/applyLoan",
  "/dashboard/viewloan",
  "/dashboard/rentMachine",
  "/dashboard/supplies",
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;

  const isPublicRoute = publicRoutes.some((route) =>
    matchesRoute(pathname, route),
  );
  if (pathname === "/home") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  const dashboardUrl = new URL("/dashboard", req.url);

  if (!session?.userId && !isPublicRoute) {
    return NextResponse.redirect(loginUrl);
  }

  if (session?.userId && isPublicRoute) {
    const role = session.userRole;
    if (role === "SECRETARY") return NextResponse.redirect(new URL("/dashboard/secretary", req.url));
    if (role === "TREASURER") return NextResponse.redirect(new URL("/dashboard/treasurer", req.url));
    if (role === "PRESIDENT") return NextResponse.redirect(new URL("/dashboard/president", req.url));
    return NextResponse.redirect(dashboardUrl);
  }

  if (
    session?.userRole === "APPLICANT" &&
    !session.hasApplied &&
    pathname !== "/registration"
  ) {
    return NextResponse.redirect(new URL("/registration", req.url));
  }

  const match = Object.keys(routeAccess).find(
    (route) => matchesRoute(pathname, route),
  );
  if (match) {
    const allowedRoles = routeAccess[match];
    if (!session?.userRole) {
      return NextResponse.redirect(loginUrl);
    }
    if (!allowedRoles.includes(session.userRole)) {
      // Membership approvals happen outside the applicant's current session.
      // Member APIs re-check the current database role, so allow the service
      // shell for applied applicants instead of trapping newly approved users
      // behind a stale APPLICANT token.
      if (
        session.userRole === "APPLICANT" &&
        session.hasApplied &&
        memberServiceRoutes.some((route) => matchesRoute(pathname, route))
      ) {
        return NextResponse.next();
      }
      return NextResponse.redirect(
        session.userRole === "SECRETARY"
          ? new URL("/dashboard/secretary", req.url)
          :         session.userRole === "TREASURER"
            ? new URL("/dashboard/treasurer", req.url)
            : session.userRole === "PRESIDENT"
              ? new URL("/dashboard/president", req.url)
              : dashboardUrl,
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
