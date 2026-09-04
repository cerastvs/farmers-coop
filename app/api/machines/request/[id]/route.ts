import {
  MachineStatus,
  NotificationType,
  Prisma,
  Role,
} from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import {
  assertTransition,
  machineTransitions,
} from "@/lib/lifecycles";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject", "start", "return", "overdue", "remind", "rejectReturn", "ping"]),
  message: z.string().trim().max(500).optional(),
});

const ACTION_STATUS = {
  approve: MachineStatus.APPROVED,
  reject: MachineStatus.REJECTED,
  start: MachineStatus.IN_USE,
  return: MachineStatus.RETURNED,
  overdue: MachineStatus.OVERDUE,
  remind: MachineStatus.OVERDUE,
  rejectReturn: MachineStatus.IN_USE,
  ping: MachineStatus.IN_USE,
} as const;

const BLOCKING_STATUSES = [
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
  MachineStatus.OVERDUE,
];

const OUTCOME_COPY: Record<
  (typeof ReviewSchema)["_output"]["action"],
  { title: string; message: (machineName: string, reason?: string) => string }
> = {
  approve: {
    title: "Machine request approved",
    message: (machineName) =>
      `Your borrow request for "${machineName}" was approved.`,
  },
  reject: {
    title: "Machine request rejected",
    message: (machineName, reason) =>
      `Your borrow request for "${machineName}" was rejected. Reason: ${reason}`,
  },
  start: {
    title: "Machine marked in use",
    message: (machineName) =>
      `Your approved booking for "${machineName}" is now in use.`,
  },
  return: {
    title: "Machine return recorded",
    message: (machineName) =>
      `The return of "${machineName}" has been recorded.`,
  },
  overdue: {
    title: "Machine booking overdue",
    message: (machineName) =>
      `Your booking for "${machineName}" has been marked overdue. Please return it as soon as possible.`,
  },
  remind: {
    title: "Machine booking overdue — reminder",
    message: (machineName) =>
      `Reminder: Your booking for "${machineName}" is still overdue. Please return it as soon as possible.`,
  },
  rejectReturn: {
    title: "Return request rejected",
    message: (machineName) =>
      `Your return request for "${machineName}" was rejected. Please continue using the machine until the scheduled end date.`,
  },
  ping: {
    title: "Return reminder",
    message: (machineName) =>
      `Reminder: Your booking for "${machineName}" has passed its scheduled end date. Please return the machine as soon as possible.`,
  },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser([
      Role.SECRETARY,
      Role.TREASURER,
      Role.PRESIDENT,
    ]);
    const result = ReviewSchema.safeParse(await req.json());
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    if (result.data.action === "reject" && !result.data.message) {
      throw new ApiError(400, "A rejection message is required");
    }

    const { id } = await params;
    const nextStatus = ACTION_STATUS[result.data.action];

    const updated = await prisma.$transaction(
      async (tx) => {
        const request = await tx.machineRequest.findUnique({
          where: { id },
          include: { machine: { select: { name: true } } },
        });
        if (!request) throw new ApiError(404, "Request not found");

        if (result.data.action === "remind") {
          if (request.status !== MachineStatus.OVERDUE) {
            throw new ApiError(409, "Can only remind overdue requests");
          }

          await notifyUser(tx, {
            userId: request.userId,
            type: NotificationType.MACHINE_OVERDUE,
            link: "/dashboard",
            title: "Machine booking overdue — reminder",
            message: `Reminder: Your booking for "${request.machine.name}" is still overdue. Please return it as soon as possible.`,
          });
          await writeAudit(tx, {
            userId: actor.userId,
            userRole: actor.userRole,
            action: "MACHINE_REQUEST_REMIND",
            entity: "MachineRequest",
            entityId: id,
          });

          return request;
        }

        if (result.data.action === "ping") {
          await notifyUser(tx, {
            userId: request.userId,
            type: NotificationType.MACHINE_OVERDUE,
            link: "/dashboard",
            title: "Return reminder",
            message: `Reminder: Your booking for "${request.machine.name}" has passed its scheduled end date. Please return the machine as soon as possible.`,
          });
          await writeAudit(tx, {
            userId: actor.userId,
            userRole: actor.userRole,
            action: "MACHINE_REQUEST_PING",
            entity: "MachineRequest",
            entityId: id,
          });

          return request;
        }

        assertTransition(
          machineTransitions,
          request.status,
          nextStatus,
          "Machine request",
        );

        if (nextStatus === MachineStatus.APPROVED) {
          if (!request.startDate || !request.endDate) {
            throw new ApiError(
              409,
              "The request must have a start and end date before approval",
            );
          }

          const overlap = await tx.machineRequest.findFirst({
            where: {
              id: { not: id },
              machineId: request.machineId,
              status: { in: BLOCKING_STATUSES },
              startDate: { lte: request.endDate },
              endDate: { gte: request.startDate },
            },
            select: { id: true },
          });
          if (overlap) {
            throw new ApiError(
              409,
              "This booking overlaps an approved or active request",
            );
          }
        }

        const machineRequest = await tx.machineRequest.update({
          where: { id },
          data: {
            status: nextStatus,
            rejectionReason:
              nextStatus === MachineStatus.REJECTED
                ? result.data.message
                : null,
            startedAt:
              nextStatus === MachineStatus.IN_USE ? new Date() : undefined,
            returnedAt:
              nextStatus === MachineStatus.RETURNED ? new Date() : undefined,
          },
        });

        const copy = OUTCOME_COPY[result.data.action];
        const notifyType =
          nextStatus === MachineStatus.APPROVED
            ? NotificationType.MACHINE_APPROVED
            : nextStatus === MachineStatus.REJECTED
              ? NotificationType.MACHINE_REJECTED
              : nextStatus === MachineStatus.OVERDUE
                ? NotificationType.MACHINE_OVERDUE
                : nextStatus === MachineStatus.RETURNED
                  ? NotificationType.MACHINE_RETURNED
                  : NotificationType.MACHINE_REQUEST;
        await notifyUser(tx, {
          userId: request.userId,
          type: notifyType,
          link: "/dashboard",
          title: copy.title,
          message: copy.message(request.machine.name, result.data.message),
        });
        await writeAudit(tx, {
          userId: actor.userId,
          userRole: actor.userRole,
          action: `MACHINE_REQUEST_${nextStatus}`,
          entity: "MachineRequest",
          entityId: id,
          previousStatus: request.status,
          newStatus: nextStatus,
          metadata: result.data.message
            ? { reason: result.data.message }
            : undefined,
        });

        return machineRequest;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      message: `Machine request marked ${updated.status.toLowerCase()}`,
      status: updated.status,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update machine request");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser();
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const request = await tx.machineRequest.findUnique({
        where: { id },
        include: { machine: { select: { name: true } } },
      });
      if (!request) throw new ApiError(404, "Request not found");
      if (request.userId !== actor.userId) {
        throw new ApiError(403, "Forbidden");
      }
      if (request.status !== MachineStatus.QUEUED) {
        throw new ApiError(409, "Only queued requests can be cancelled");
      }

      await tx.machineRequest.delete({ where: { id } });
      await notifyUser(tx, {
        userId: actor.userId,
        type: NotificationType.MACHINE_REQUEST,
        link: "/dashboard",
        title: "Machine request cancelled",
        message: `Your borrow request for "${request.machine.name}" was cancelled.`,
      });
      await writeAudit(tx, {
        userId: actor.userId,
        userRole: actor.userRole,
        action: "MACHINE_REQUEST_CANCELLED",
        entity: "MachineRequest",
        entityId: id,
        metadata: {
          machineId: request.machineId,
          machineName: request.machine.name,
        },
      });
    });

    return NextResponse.json({ message: "Request cancelled successfully" });
  } catch (error) {
    return apiErrorResponse(error, "Failed to cancel request");
  }
}
