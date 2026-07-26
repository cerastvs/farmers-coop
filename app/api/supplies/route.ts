import {
  Prisma,
  Role,
  SupplyTransactionType,
  TransactionStatus,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SupplyRequestSchema = z.object({
  supplyId: z.string().uuid(),
  quantity: z.number().int().positive().max(2_147_483_647),
  type: z.nativeEnum(SupplyTransactionType),
}).strict();

export async function GET() {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const [supplies, requests] = await Promise.all([
      prisma.supply.findMany({ orderBy: { productName: "asc" } }),
      prisma.supplyTransaction.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
        include: { supply: true },
      }),
    ]);

    return NextResponse.json({
      supplies: supplies.map((supply) => ({
        ...supply,
        price: Number(supply.price),
      })),
      requests: requests.map((request) => ({
        ...request,
        totalPrice: Number(request.totalPrice),
        supply: {
          ...request.supply,
          price: Number(request.supply.price),
        },
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch supplies");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const result = SupplyRequestSchema.safeParse(await readJsonBody(req));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const request = await prisma.$transaction(
      async (tx) => {
        const supply = await tx.supply.findUnique({
          where: { id: result.data.supplyId },
        });
        if (!supply) throw new ApiError(404, "Supply not found");
        if (result.data.quantity > supply.quantity) {
          throw new ApiError(
            400,
            "Requested quantity exceeds available stock",
          );
        }

        const duplicate = await tx.supplyTransaction.findFirst({
          where: {
            userId: actor.userId,
            supplyId: supply.id,
            status: {
              in: [TransactionStatus.PENDING, TransactionStatus.APPROVED],
            },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ApiError(
            409,
            "You already have an open request for this item",
          );
        }

        const totalPrice = supply.price.mul(result.data.quantity);
        if (totalPrice.greaterThan(new Prisma.Decimal("99999999.99"))) {
          throw new ApiError(400, "Request total exceeds the supported limit");
        }

        const created = await tx.supplyTransaction.create({
          data: {
            userId: actor.userId,
            supplyId: supply.id,
            quantity: result.data.quantity,
            totalPrice,
            type: result.data.type,
          },
        });
        await writeAudit(tx, {
          userId: actor.userId,
          action: "SUPPLY_REQUESTED",
          entity: "SupplyTransaction",
          entityId: created.id,
          metadata: {
            supplyId: supply.id,
            quantity: result.data.quantity,
            type: result.data.type,
          },
        });
        const reviewers = await tx.user.findMany({
          where: {
            role: { in: [Role.SECRETARY, Role.TREASURER] },
            active: true,
          },
          select: { id: true },
        });
        await Promise.all(
          reviewers.map((reviewer) =>
            notifyUser(tx, {
              userId: reviewer.id,
              title: "New supply request",
              message: `A request for ${result.data.quantity} ${supply.productName} is ready for review.`,
            }),
          ),
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      { message: "Supply request submitted", requestId: request.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit supply request");
  }
}
