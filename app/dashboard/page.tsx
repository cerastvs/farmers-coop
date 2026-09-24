import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getApplicationFeeStatus,
  getDashboardStats,
  getDashboardUser,
} from "@/lib/services/dashboard";
import { officerPanelRoute } from "@/lib/services/panel-access";
import type { Role } from "@/app/generated/prisma";
import { DashboardClient } from "./components/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await getDashboardUser(session.userId, session.hasApplied);

  if (!user) {
    redirect("/login");
  }

  // Officers never see the member dashboard; send them to their own panel.
  const panel = officerPanelRoute(user.role as Role);
  if (panel !== "/dashboard") {
    redirect(panel);
  }

  const pendingApplicant = user.role === "APPLICANT" && user.hasApplied;
  const stats = pendingApplicant ? null : await getDashboardStats(session.userId);
  const applicationFeeStatus = pendingApplicant
    ? await getApplicationFeeStatus(session.userId)
    : null;

  return (
    <DashboardClient
      user={user}
      stats={stats}
      applicationFeeStatus={applicationFeeStatus}
    />
  );
}