import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const username = formData.get("username");
    const password = formData.get("password");

    return NextResponse.json(
      {
        message: "Data Revecieved. ",
        data: { username, password },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 400 },
    );
  }
}
