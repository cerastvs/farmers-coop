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

    const { machineName, status } = await prisma.$transaction(async (tx) => {
      const request = await tx.machineRequest.findUnique({
        where: { id },
        include: { machine: { select: { name: true } } },
      });
      if (!request) throw new ApiError(404, "Request not found");
      if (request.userId !== userId) {
        throw new ApiError(403, "You can only start your own requests");
      }

      assertTransition(
        machineTransitions,
        request.status,
        MachineStatus.IN_USE,
        "Machine request",
      );

      const machineRequest = await tx.machineRequest.update({
        where: { id },
        data: { status: MachineStatus.IN_USE, startedAt: new Date() },
      });

      const secretaries = await tx.user.findMany({
        where: { role: Role.SECRETARY, active: true },
        select: { id: true },
      });
      await Promise.all(
        secretaries.map((s) =>
          notifyUser(tx, {
            userId: s.id,
            title: "Machine use confirmed",
            message: `A member has confirmed pickup of "${request.machine.name}". It is now in use.`,
          }),
        ),
      );

      await writeAudit(tx, {
        userId,
        action: "MACHINE_REQUEST_IN_USE",
        entity: "MachineRequest",
        entityId: id,
      });

      return { machineName: request.machine.name, status: machineRequest.status };
    });

    return NextResponse.json({
      message: `Pickup confirmed. "${machineName}" is now in use.`,
      status,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to confirm pickup");
  }
}
