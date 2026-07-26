import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { apiErrorResponse, requireUser } from "@/lib/api";
import { MEMBER_ROLES } from "@/lib/permissions";
import { MachineStatus, Role } from "@/app/generated/prisma";
import { notifyUser, writeAudit } from "@/lib/activity";

const BLOCKING_STATUSES = [MachineStatus.APPROVED, MachineStatus.IN_USE];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUser(MEMBER_ROLES);
    const { machineId, startDate, endDate } = await req.json();

    if (!machineId) {
      return NextResponse.json(
        { error: "Machine ID is required" },
        { status: 400 },
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 },
      );
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    if (startStr < todayStr) {
      return NextResponse.json(
        { error: "Start date cannot be in the past" },
        { status: 400 },
      );
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        requests: {
          where: { status: { in: BLOCKING_STATUSES } },
        },
      },
    });

    if (!machine) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 },
      );
    }

    const hasOverlap = machine.requests.some((r) => {
      if (!r.startDate || !r.endDate) return false;
      return start <= r.endDate && end >= r.startDate;
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: "Selected dates overlap with an existing booking" },
        { status: 409 },
      );
    }

    const borrowRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.machineRequest.create({
        data: {
          userId,
          machineId,
          status: MachineStatus.QUEUED,
          startDate: start,
          endDate: end,
        },
      });
      await writeAudit(tx, {
        userId,
        action: "MACHINE_REQUESTED",
        entity: "MachineRequest",
        entityId: created.id,
        metadata: {
          machineId,
          startDate,
          endDate,
        },
      });
      const reviewers = await tx.user.findMany({
        where: { role: Role.SECRETARY, active: true },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            title: "New machine request",
            message: `A request for ${machine.name} is ready for review.`,
          }),
        ),
      );
      return created;
    });

    return NextResponse.json({
      message: "Borrow request submitted successfully",
      requestId: borrowRequest.id,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to submit borrow request");
  }
}
