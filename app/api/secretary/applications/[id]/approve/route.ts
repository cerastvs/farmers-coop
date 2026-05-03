import { NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { Role, ApplicationStatus } from "@/app/generated/prisma";

export async function POST(
  req: Request,
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
    const application = await prisma.application.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (application.status !== ApplicationStatus.PENDING) {
      return NextResponse.json(
        { error: "Application is already processed" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedBy: session.userId,
        },
      }),
      prisma.user.update({
        where: { id: application.userId },
        data: {
          role: Role.MEMBER,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approve application error:", error);
    return NextResponse.json(
      { error: "Failed to approve application" },
      { status: 500 },
    );
  }
}
