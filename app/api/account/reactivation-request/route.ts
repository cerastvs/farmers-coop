import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse, ApiError } from "@/lib/api";
import { requestReactivation } from "@/lib/account-status";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";

/**
 * A disabled member asks for their account back.
 *
 * This is the one authenticated route that must serve an *inactive* user, so
 * it cannot go through `requireUser` — that guard rejects inactive accounts on
 * purpose. Instead the session is checked directly and the account is required
 * to still be disabled, which is what keeps this from being a generic
 * write-any-user endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      throw new ApiError(401, "Not authenticated");
    }

    const body = (await req.json().catch(() => ({}))) as {
      message?: unknown;
    };
    if (
      body.message !== undefined &&
      (typeof body.message !== "string" || body.message.length > 500)
    ) {
      throw new ApiError(400, "Message must be 500 characters or fewer");
    }

    const account = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { active: true },
    });
    if (!account) throw new ApiError(404, "Account not found");
    if (account.active) {
      throw new ApiError(409, "This account is already active");
    }

    const result = await requestReactivation({
      memberId: session.userId,
      message: typeof body.message === "string" ? body.message : null,
    });

    return NextResponse.json({
      alreadyRequested: result.alreadyRequested,
      message: result.alreadyRequested
        ? "Your request is already with the President and Secretary."
        : "Your request has been sent to the President and Secretary.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit reactivation request");
  }
}
