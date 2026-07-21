import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { Role } from "@/app/generated/prisma";

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

export async function PUT(
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

  try {
    const existing = await prisma.machine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const image = formData.get("image") as File | null;
    const removeImage = formData.get("removeImage") as string | null;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Machine name is required" },
        { status: 400 },
      );
    }

    let imageUrl = existing.imageUrl;
    if (image && image.size > 0) {
      imageUrl = await uploadToImgbb(image);
    } else if (removeImage === "true") {
      imageUrl = null;
    }

    const machine = await prisma.machine.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        imageUrl,
      },
    });

    return NextResponse.json({
      message: "Machine updated successfully",
      machine: {
        id: machine.id,
        name: machine.name,
        description: machine.description,
        imageUrl: machine.imageUrl,
      },
    });
  } catch (error) {
    console.error("Update machine error:", error);
    return NextResponse.json(
      { error: "Failed to update machine" },
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

  if (session.userRole !== Role.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.machine.findUnique({
      where: { id },
      include: {
        requests: {
          where: {
            status: { in: ["QUEUED", "APPROVED", "IN_USE"] },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 },
      );
    }

    if (existing.requests.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete machine with active requests" },
        { status: 409 },
      );
    }

    await prisma.machine.delete({ where: { id } });

    return NextResponse.json({ message: "Machine deleted successfully" });
  } catch (error) {
    console.error("Delete machine error:", error);
    return NextResponse.json(
      { error: "Failed to delete machine" },
      { status: 500 },
    );
  }
}
