import prisma from "@/lib/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<Record<string, string>> },
) {
  const id = (await params).id;
  console.log(typeof id);
  const user = await prisma.user.findUnique({
    where: { id },
  });

  return NextResponse.json(user, { status: 200 });
}
