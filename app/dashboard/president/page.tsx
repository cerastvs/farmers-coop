import { requireOfficerPanel } from "@/lib/services/panel-access";

import OfficerDashboard from "../components/OfficerDashboard";

export default async function PresidentDashboard() {
  await requireOfficerPanel("PRESIDENT");
  return <OfficerDashboard role="PRESIDENT" />;
}