import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.notification.updateMany({
      where: { id, userId: session.userId },
      data: { read: true },
    });

    return NextResponse.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
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
    await prisma.notification.deleteMany({
      where: { id, userId: session.userId },
    });

    return NextResponse.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
