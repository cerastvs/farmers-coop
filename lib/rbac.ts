import { Role } from "@/app/generated/prisma";

const cooperativeMemberRoles = [
  Role.PRESIDENT,
  Role.TREASURER,
  Role.SECRETARY,
  Role.MEMBER,
];

export const routeAccess: Record<string, Role[]> = {
  "/dashboard/secretary": [Role.SECRETARY, Role.PRESIDENT],
  "/dashboard/treasurer": [Role.TREASURER, Role.PRESIDENT],
  "/dashboard/applyLoan": cooperativeMemberRoles,
  "/dashboard/viewloan": cooperativeMemberRoles,
  "/dashboard/rentMachine": cooperativeMemberRoles,
  "/dashboard/supplies": cooperativeMemberRoles,
  "/admin": [Role.PRESIDENT, Role.SECRETARY, Role.TREASURER],
  "/dashboard": [...cooperativeMemberRoles, Role.APPLICANT],
  "/registration": [Role.APPLICANT, Role.MEMBER],
};
