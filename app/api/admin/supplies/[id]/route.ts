import { writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { SUPPLY_REVIEW_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SupplySchema = z.object({
  productName: z.string().trim().min(2).max(100),
  price: z.number().nonnegative().max(99_999_999.99).multipleOf(0.01),
  quantity: z.number().int().nonnegative().max(2_147_483_647),
  loanLimitPerHectare: z.number().int().nonnegative().max(10_000).nullable().optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(SUPPLY_REVIEW_ROLES);
    const result = SupplySchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Supply ID");

    const supply = await prisma.$transaction(async (tx) => {
      const updated = await tx.supply.update({
        where: { id },
        data: result.data,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "SUPPLY_UPDATED",
        entity: "Supply",
        entityId: id,
        metadata: result.data,
      });
      return updated;
    });

    return NextResponse.json({ ...supply, price: Number(supply.price) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update supply");
  }
}
