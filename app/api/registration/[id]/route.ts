import prisma from "@/lib/client";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<Record<string, string>> },
) {
  const id = (await params).id;
  const user = await prisma.application.findUnique({
    where: { id },
  });

  return NextResponse.json(user, { status: 200 });
}
