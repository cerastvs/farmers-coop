import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { MachineStatus, Role } from "@/app/generated/prisma";

export async function PATCH(
  req: NextRequest,
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
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const rejectionMessage = (body.message as string) || "";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  if (action === "reject" && !rejectionMessage.trim()) {
    return NextResponse.json(
      { error: "Rejection message is required" },
      { status: 400 },
    );
  }

  try {
    const request = await prisma.machineRequest.findUnique({
      where: { id },
      include: { machine: { select: { name: true } } },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 },
      );
    }

    if (request.status !== MachineStatus.QUEUED) {
      return NextResponse.json(
        { error: "Only pending requests can be processed" },
        { status: 400 },
      );
    }

    const newStatus =
      action === "approve" ? MachineStatus.APPROVED : MachineStatus.REJECTED;

    if (action === "reject") {
      await prisma.$transaction([
        prisma.machineRequest.update({
          where: { id },
          data: { status: newStatus, rejectionReason: rejectionMessage.trim() },
        }),
        prisma.notification.create({
          data: {
            userId: request.userId,
            title: `Machine Request Rejected`,
            message: `Your borrow request for "${request.machine.name}" was rejected. Reason: ${rejectionMessage.trim()}`,
          },
        }),
      ]);
    } else {
      await prisma.machineRequest.update({
        where: { id },
        data: { status: newStatus },
      });
    }

    return NextResponse.json({
      message: `Request ${action === "approve" ? "approved" : "rejected"}`,
    });
  } catch (error) {
    console.error("Update request error:", error);
    return NextResponse.json(
      { error: "Failed to update request" },
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
