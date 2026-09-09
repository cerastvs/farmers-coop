// app/api/me/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDashboardUser } from "@/lib/services/dashboard";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getDashboardUser(session.userId, session.hasApplied);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}