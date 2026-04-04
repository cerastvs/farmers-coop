import prisma from "@/lib/client";
import { NextResponse } from "next/server";
import Dashboard from "@/app/dashboard/page";
export async function GET(
  req: Request,
  { params }: { params: Promise<Record<string, string>> },
) {
  const id = (await params).id;
  console.log(typeof id);
  const user = await prisma.user.findUnique({
    where: { id },
  });

  return NextResponse.json({ user }, { status: 200 });
}
