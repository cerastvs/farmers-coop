import prisma from "@/lib/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username;
    const password = await bcrypt.hash(body.password, 10);

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing username or password" },
        { status: 400 },
      );
    }
    await prisma.user.create({
      data: { username: username.toString(), password: password.toString() },
    });

    return NextResponse.json({ message: "User created!" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Username is already taken" },
      { status: 400 },
    );
  }
}
