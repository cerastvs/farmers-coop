import prisma from "@/lib/client";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { RegistrationSchema } from "@/lib/validators/signup";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = RegistrationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { username, password } = result.data;

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { username: username.toString(), password: hashedPassword },
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
