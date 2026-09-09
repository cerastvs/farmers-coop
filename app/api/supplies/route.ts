import { GuarantorStatus } from "@/app/generated/prisma";
import {
  apiErrorResponse,
  ApiError,
  readJsonBody,
  requireUser,
} from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBER_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import {
  SupplyRequestSchema,
  submitSupplyTransaction,
} from "@/lib/services/member-actions";
import { ONLINE_CONTEXT } from "@/lib/services/entry-context";

export async function GET() {
  try {
    const actor = await requireUser(MEMBER_ROLES);
    const [supplies, requests, application] = await Promise.all([
      prisma.supply.findMany({ orderBy: { productName: "asc" } }),
      prisma.supplyTransaction.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
        include: { supply: true },
      }),
      prisma.application.findFirst({
        where: { userId: actor.userId },
        orderBy: { createdAt: "desc" },
        select: { guarantor: true, guarantorStatus: true },
      }),
    ]);

    const guarantor = application?.guarantor;
    const guarantorRecord =
      guarantor && typeof guarantor === "object"
        ? (guarantor as Record<string, unknown>)
        : null;
    const hasGuarantorOnFile = Boolean(
      guarantorRecord &&
        String(guarantorRecord.firstName ?? "").trim() &&
        String(guarantorRecord.lastName ?? "").trim(),
    );
    const guarantorStatus = application?.guarantorStatus ?? null;
    const hasGuarantor =
      hasGuarantorOnFile && guarantorStatus === GuarantorStatus.APPROVED;

    return NextResponse.json({
      hasGuarantor,
      guarantorStatus,
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

    const request = await submitSupplyTransaction({
      actor,
      memberId: actor.userId,
      supplyId: result.data.supplyId,
      quantity: result.data.quantity,
      type: result.data.type,
      context: ONLINE_CONTEXT,
    });

    return NextResponse.json(
      { message: "Supply request submitted", requestId: request.id },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit supply request");
  }
}
