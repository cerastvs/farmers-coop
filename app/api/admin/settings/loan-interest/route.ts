import bcrypt from "bcryptjs";
import { Role } from "@/app/generated/prisma";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import { writeAudit } from "@/lib/activity";
import prisma from "@/lib/client";
import { OFFICER_ROLES } from "@/lib/permissions";
import {
  getLoanInterestRate,
  LOAN_INTEREST_SETTING_KEY,
} from "@/lib/services/loan-interest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RateSchema = z
  .object({
    rate: z.coerce.number().min(0).max(100),
    password: z.string().min(1, "Password is required to confirm this change"),
  })
  .strict();

export async function GET() {
  try {
    await requireUser(OFFICER_ROLES);
    const rate = await getLoanInterestRate();
    return NextResponse.json({ rate });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load loan settings");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireUser([Role.PRESIDENT]);
    const result = RateSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    const { rate, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { password: true },
    });
    const passwordValid = user?.password
      ? await bcrypt.compare(password, user.password)
      : false;
    if (!passwordValid) {
      throw new ApiError(403, "Incorrect password");
    }

    await prisma.$transaction(async (tx) => {
      await tx.coopSetting.upsert({
        where: { key: LOAN_INTEREST_SETTING_KEY },
        create: { key: LOAN_INTEREST_SETTING_KEY, value: String(rate) },
        update: { value: String(rate) },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "SETTING_UPDATED",
        entity: "CoopSetting",
        entityId: LOAN_INTEREST_SETTING_KEY,
        metadata: {
          key: LOAN_INTEREST_SETTING_KEY,
          previousValue: String(rate),
          value: String(rate),
        },
      });
    });

    return NextResponse.json({ rate });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update loan settings");
  }
}