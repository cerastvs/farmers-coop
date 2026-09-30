import { Role } from "../app/generated/prisma";

/**
 * Whether `next` would actually change a member's role. Echoing the current
 * value back is a harmless no-op (several editors round-trip the whole record),
 * so it is not treated as a change.
 */
export function isRoleChange(current: Role, next: Role | undefined): boolean {
  return next !== undefined && next !== current;
}

/**
 * Changing a member's role is a privilege reserved for the president alone.
 *
 * Enforced here — as a pure function — and called from the single shared
 * service that every member editor and API routes through, so the rule holds
 * no matter how a request reaches it. Returns false only when a real role
 * change is attempted by a non-president.
 */
export function canChangeRole(
  actorRole: Role | undefined,
  current: Role,
  next: Role | undefined,
): boolean {
  if (!isRoleChange(current, next)) return true;
  return actorRole === Role.PRESIDENT;
}
