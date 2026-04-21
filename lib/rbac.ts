import { Role } from "@/app/generated/prisma/enums";

export const routeAccess: Record<string, Role[]> = {
  "/dashboard/secretary": [Role.SECRETARY],
  "/admin": [Role.PRESIDENT, Role.SECRETARY, Role.TREASURER],
  "/dashboard": [Role.PRESIDENT, Role.TREASURER, Role.SECRETARY, Role.MEMBER],
  "/registration": [Role.APPLICANT, Role.MEMBER],
};
