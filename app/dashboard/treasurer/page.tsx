import { requireOfficerPanel } from "@/lib/services/panel-access";

import OfficerDashboard from "../components/OfficerDashboard";

export default async function TreasurerDashboard() {
  await requireOfficerPanel("TREASURER");
  return <OfficerDashboard role="TREASURER" />;
}