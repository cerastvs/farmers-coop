import { requireOfficerPanel } from "@/lib/services/panel-access";

import OfficerDashboard from "../components/OfficerDashboard";

export default async function SecretaryDashboard() {
  await requireOfficerPanel("SECRETARY");
  return <OfficerDashboard role="SECRETARY" />;
}