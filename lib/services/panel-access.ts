import "server-only";

import { redirect } from "next/navigation";

import { Role } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";

// Role-specific panel routes. Officers only ever see their own panel; members
// and applicants fall back to the member dashboard.
const OFFICER_PANELS: Partial<Record<Role, string>> = {
  PRESIDENT: "/dashboard/president",
  SECRETARY: "/dashboard/secretary",
  TREASURER: "/dashboard/treasurer",
};

export function officerPanelRoute(role: Role): string {
  return OFFICER_PANELS[role] ?? "/dashboard";
}

// Guards an officer panel page (e.g. /dashboard/secretary) so it only renders
// for the matching role. Not-authenticated and inactive accounts are sent to
// the login page; anyone whose role does not match is redirected to their own
// panel (officers) or the member dashboard (members/applicants).
export async function requireOfficerPanel(expectedRole: Role) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, active: true },
  });

  if (!user || !user.active) redirect("/login");
  if (user.role !== expectedRole) redirect(officerPanelRoute(user.role));
}