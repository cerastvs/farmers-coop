import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { MachineStatus } from "@/app/generated/prisma";

const ACTIVE_STATUSES = [MachineStatus.QUEUED, MachineStatus.APPROVED, MachineStatus.IN_USE];

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    const { machineId } = await req.json();

    if (!machineId) {
      return NextResponse.json(
        { error: "Machine ID is required" },
        { status: 400 },
      );
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        requests: {
          where: { status: { in: ACTIVE_STATUSES } },
        },
      },
    });

    if (!machine) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 },
      );
    }

    const userAlreadyHasRequest = machine.requests.some(
      (r) => r.userId === userId,
    );

    if (userAlreadyHasRequest) {
      return NextResponse.json(
        { error: "You already have an active request for this machine" },
        { status: 409 },
      );
    }

    const available = machine.quantity - machine.requests.length;

    if (available <= 0) {
      return NextResponse.json(
        { error: "No units of this machine are currently available" },
        { status: 409 },
      );
    }

    const borrowRequest = await prisma.machineRequest.create({
      data: {
        userId,
        machineId,
        status: MachineStatus.QUEUED,
      },
    });

    return NextResponse.json({
      message: "Borrow request submitted successfully",
      requestId: borrowRequest.id,
    });
  } catch (error) {
    console.error("Borrow machine error:", error);
    return NextResponse.json(
      { error: "Failed to submit borrow request" },
      { status: 500 },
    );
  }
}
