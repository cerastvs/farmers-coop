import { Role } from "@/app/generated/prisma";

export const MEMBER_ROLES = [
  Role.MEMBER,
  Role.PRESIDENT,
  Role.TREASURER,
  Role.SECRETARY,
] as const;

export const FINANCE_ROLES = [Role.TREASURER, Role.PRESIDENT] as const;

export const MEMBERSHIP_ROLES = [Role.SECRETARY, Role.PRESIDENT] as const;

export const RECORDS_ROLES = [
  Role.SECRETARY,
  Role.PRESIDENT,
  Role.TREASURER,
] as const;

export const SUPPLY_REVIEW_ROLES = [
  Role.SECRETARY,
  Role.TREASURER,
] as const;
