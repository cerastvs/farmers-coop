import { MachineStatus, Role } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { assertTransition, machineTransitions } from "@/lib/lifecycles";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireUser([
      Role.MEMBER,
      Role.TREASURER,
      Role.PRESIDENT,
    ]);
    const { id } = await params;

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.machineRequest.findUnique({
        where: { id },
        include: { machine: { select: { name: true } } },
      });
      if (!request) throw new ApiError(404, "Request not found");
      if (request.userId !== userId) {
        throw new ApiError(403, "You can only return your own requests");
      }

      assertTransition(
        machineTransitions,
        request.status,
        MachineStatus.RETURN_PENDING,
        "Machine request",
      );

      const machineRequest = await tx.machineRequest.update({
        where: { id },
        data: { status: MachineStatus.RETURN_PENDING },
      });

      const secretaries = await tx.user.findMany({
        where: { role: Role.SECRETARY, active: true },
        select: { id: true },
      });
      await Promise.all(
        secretaries.map((s) =>
          notifyUser(tx, {
            userId: s.id,
            title: "Machine return requested",
            message: `A member has requested to return "${request.machine.name}" early. Please confirm the return.`,
          }),
        ),
      );

      await writeAudit(tx, {
        userId,
        action: "MACHINE_REQUEST_RETURN_PENDING",
        entity: "MachineRequest",
        entityId: id,
      });

      return machineRequest;
    });

    return NextResponse.json({
      message: "Return requested. Waiting for secretary confirmation.",
      status: updated.status,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to request return");
  }
}
