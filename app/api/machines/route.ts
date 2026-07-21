import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { MachineStatus } from "@/app/generated/prisma";

const ACTIVE_STATUSES = [MachineStatus.QUEUED, MachineStatus.APPROVED, MachineStatus.IN_USE];

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    const machines = await prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: {
        requests: {
          where: { status: { in: ACTIVE_STATUSES } },
          select: { id: true, userId: true, status: true },
        },
      },
    });

    const result = machines.map((machine) => {
      const activeRequests = machine.requests.length;
      const available = machine.quantity - activeRequests;
      const userHasActiveRequest = machine.requests.some(
        (r) => r.userId === userId,
      );

      return {
        id: machine.id,
        name: machine.name,
        description: machine.description,
        quantity: machine.quantity,
        activeRequests,
        available: available > 0 ? available : 0,
        userHasActiveRequest,
      };
    });

    return NextResponse.json({ machines: result });
  } catch (error) {
    console.error("Fetch machines error:", error);
    return NextResponse.json(
      { error: "Failed to fetch machines" },
      { status: 500 },
    );
  }
}
