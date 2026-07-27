import { NextResponse } from "next/server";

import { Prisma, Role } from "@/app/generated/prisma";
import prisma from "@/lib/client";
import { ApiError } from "@/lib/errors";
import { getSession } from "@/lib/session";

export { ApiError } from "@/lib/errors";

export type AuthenticatedUser = {
  userId: string;
  userRole: Role;
};

export async function requireUser(
  allowedRoles?: readonly Role[],
): Promise<AuthenticatedUser> {
  const session = await getSession();

  if (!session) {
    throw new ApiError(401, "Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, active: true },
  });

  if (!user || !user.active) {
    throw new ApiError(403, "Account is inactive");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ApiError(403, "Forbidden");
  }

  return { userId: user.id, userRole: user.role };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

export function requireUuid(value: string, subject = "ID") {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ApiError(400, `${subject} must be a valid UUID`);
  }

  return value;
}

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A conflicting record already exists" },
        { status: 409 },
      );
    }
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Related record not found" },
        { status: 400 },
      );
    }
    if (error.code === "P2014") {
      return NextResponse.json(
        { error: "A required related record is missing" },
        { status: 400 },
      );
    }
    if (error.code === "P2034") {
      return NextResponse.json(
        { error: "The record changed while processing; please try again" },
        { status: 409 },
      );
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error(fallback, error);
    return NextResponse.json(
      { error: "A database error occurred" },
      { status: 500 },
    );
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
