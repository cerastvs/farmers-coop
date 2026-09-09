import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getApplicationFeeStatus,
  getDashboardStats,
  getDashboardUser,
} from "@/lib/services/dashboard";
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