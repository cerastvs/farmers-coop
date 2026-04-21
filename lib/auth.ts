import { Role } from "@/app/generated/prisma/enums";
import { routeAccess } from "./rbac";

export function canAccess(path: string, role?: Role) {
  if (!role) return false;

  const match = Object.keys(routeAccess).find(
    (route) => path === route || path.startsWith(route + "/"),
  );

  if (!match) return true;

  return routeAccess[match].includes(role);
}
