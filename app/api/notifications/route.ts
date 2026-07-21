import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids = body.ids as string[] | undefined;

  try {
    if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: session.userId },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: session.userId, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
