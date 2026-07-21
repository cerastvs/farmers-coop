import { Role } from "@/app/generated/prisma";

export const routeAccess: Record<string, Role[]> = {
  "/dashboard/secretary": [Role.SECRETARY],
  "/dashboard/rentMachine": [
    Role.PRESIDENT,
    Role.TREASURER,
    Role.SECRETARY,
    Role.MEMBER,
  ],
  "/admin": [Role.PRESIDENT, Role.SECRETARY, Role.TREASURER],
  "/dashboard": [
    Role.PRESIDENT,
    Role.TREASURER,
    Role.SECRETARY,
    Role.MEMBER,
    Role.APPLICANT,
  ],
  "/registration": [Role.APPLICANT, Role.MEMBER],
};
