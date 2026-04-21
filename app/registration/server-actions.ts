"use server";

import prisma from "@/lib/client";
import { createSession, getUserId } from "@/lib/session";
import { Role } from "@/app/generated/prisma/enums";

export async function refreshSession() {
  const userId = await getUserId();
  if (userId === "error") return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return;

  const application = await prisma.application.findFirst({
    where: { userId },
  });

  await createSession(userId, user.role as Role, !!application);
}
