import { writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import { SUPPLY_REVIEW_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SupplySchema = z.object({
  productName: z.string().trim().min(2).max(100),
  price: z.number().nonnegative().max(99_999_999.99).multipleOf(0.01),
  quantity: z.number().int().nonnegative().max(2_147_483_647),
}).strict();

export async function GET() {
  try {
    await requireUser(SUPPLY_REVIEW_ROLES);
    const supplies = await prisma.supply.findMany({
      orderBy: { productName: "asc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    return NextResponse.json(
      supplies.map((supply) => ({
        ...supply,
        price: Number(supply.price),
        transactions: supply.transactions.map((transaction) => ({
          ...transaction,
          totalPrice: Number(transaction.totalPrice),
        })),
      })),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch supply inventory");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(SUPPLY_REVIEW_ROLES);
    const result = SupplySchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const supply = await prisma.$transaction(async (tx) => {
      const created = await tx.supply.create({ data: result.data });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "SUPPLY_CREATED",
        entity: "Supply",
        entityId: created.id,
        metadata: result.data,
      });
      return created;
    });

    return NextResponse.json(
      { ...supply, price: Number(supply.price) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create supply");
  }
}
