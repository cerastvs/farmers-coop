import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { apiErrorResponse, requireUser } from "@/lib/api";
import { MEMBER_ROLES } from "@/lib/permissions";
import { Role, MachineStatus } from "@/app/generated/prisma";
import { writeAudit } from "@/lib/activity";

const ACTIVE_STATUSES = [
  MachineStatus.QUEUED,
  MachineStatus.APPROVED,
  MachineStatus.IN_USE,
  MachineStatus.RETURN_PENDING,
  MachineStatus.OVERDUE,
];

async function uploadToImgbb(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API}`,
    { method: "POST", body: formData },
  );

  const data = await res.json();
  if (!data.success) {
    throw new Error("Image upload failed");
  }
  return data.data.url;
}

export async function GET() {
  try {
    const { userId } = await requireUser(MEMBER_ROLES);
    const machines = await prisma.machine.findMany({
      orderBy: { name: "asc" },
      include: {
        requests: {
          where: { status: { in: ACTIVE_STATUSES } },
          select: {
            id: true,
            userId: true,
            status: true,
            startDate: true,
            endDate: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    const result = machines.map((machine) => {
      const myRequests = machine.requests
        .filter((r) => r.userId === userId)
        .map((r) => ({
          id: r.id,
          status: String(r.status),
          startDate: r.startDate?.toISOString() ?? null,
          endDate: r.endDate?.toISOString() ?? null,
        }));

      const otherRequests = machine.requests
        .filter((r) => r.userId !== userId && r.startDate && r.endDate)
        .map((r) => ({
          id: r.id,
          borrower: r.user.name || "Unknown",
          status: String(r.status),
          startDate: r.startDate!.toISOString(),
          endDate: r.endDate!.toISOString(),
        }));

      const bookedDates = machine.requests
        .filter((r) => r.startDate && r.endDate)
        .map((r) => ({
          startDate: r.startDate!.toISOString(),
          endDate: r.endDate!.toISOString(),
          status: String(r.status),
        }));

      return {
        id: machine.id,
        name: machine.name,
        description: machine.description,
        imageUrl: machine.imageUrl,
        myRequests,
        otherRequests,
        bookedDates,
      };
    });

    return NextResponse.json({ machines: result });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch machines");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser([Role.SECRETARY]);
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const image = formData.get("image") as File | null;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Machine name is required" },
        { status: 400 },
      );
    }

    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      imageUrl = await uploadToImgbb(image);
    }

    const machine = await prisma.$transaction(async (tx) => {
      const created = await tx.machine.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl,
        },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MACHINE_CREATED",
        entity: "Machine",
        entityId: created.id,
        metadata: { name: created.name },
      });
      return created;
    });

    return NextResponse.json({
      message: "Machine created successfully",
      machine: {
        id: machine.id,
        name: machine.name,
        description: machine.description,
        imageUrl: machine.imageUrl,
      },
    });
  } catch (error) {
    console.error("Create machine error:", error);
    return NextResponse.json(
      { error: "Failed to create machine" },
      { status: 500 },
    );
  }
}
