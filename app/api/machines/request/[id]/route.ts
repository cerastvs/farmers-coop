import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { MachineStatus, Role } from "@/app/generated/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.userRole !== Role.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const request = await prisma.machineRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 },
      );
    }

    if (request.status !== MachineStatus.QUEUED) {
      return NextResponse.json(
        { error: "Only pending requests can be approved" },
        { status: 400 },
      );
    }

    const updated = await prisma.machineRequest.update({
      where: { id },
      data: { status: MachineStatus.APPROVED },
    });

    return NextResponse.json({ message: "Request approved", request: updated });
  } catch (error) {
    console.error("Approve request error:", error);
    return NextResponse.json(
      { error: "Failed to approve request" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const request = await prisma.machineRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 },
      );
    }

    if (request.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.status !== MachineStatus.QUEUED) {
      return NextResponse.json(
        { error: "Only pending requests can be cancelled" },
        { status: 400 },
      );
    }

    await prisma.machineRequest.delete({ where: { id } });

    return NextResponse.json({ message: "Request cancelled successfully" });
  } catch (error) {
    console.error("Cancel request error:", error);
    return NextResponse.json(
      { error: "Failed to cancel request" },
      { status: 500 },
    );
  }
}
