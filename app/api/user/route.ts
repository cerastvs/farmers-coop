import bcrypt from "bcryptjs";
import { Prisma } from "@/app/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

import { writeActivityLog, writeAudit } from "@/lib/activity";
import prisma from "@/lib/client";
import { RegistrationSchema } from "@/lib/validators/signup";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = RegistrationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { username, password } = result.data;

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username, password: hashedPassword },
        select: { id: true },
      });
      await writeAudit(tx, {
        userId: created.id,
        action: "ACCOUNT_REGISTERED",
        entity: "User",
        entityId: created.id,
      });
      return created;
    });

    await writeActivityLog({
      userId: user.id,
      action: "REGISTER",
      success: true,
      info: `Account registered for username ${username}`,
    });

    return NextResponse.json({ message: "User created!" }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
