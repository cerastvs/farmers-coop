import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { Role } from "@/app/generated/prisma/enums";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(userId: string, userRole: Role) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, expiresAt, userRole });

  (await cookies()).set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    path: "/",
    sameSite: "strict",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;

  try {
    const data = await decrypt(sessionCookie);
    if (
      typeof data === "object" &&
      data !== null &&
      "userId" in data &&
      "expiresAt" in data &&
      "userRole" in data
    ) {
      const { userId, userRole, expiresAt } = data as {
        userId: string;
        userRole: Role;
        expiresAt: string | Date;
      };

      if (expiresAt < new Date()) return null;

      return { userId, userRole };
    }

    return null;
  } catch (err) {
    console.error("Failed to decrypt session:", err);
    return null;
  }
}

type SessionPayload = {
  userId: string;
  expiresAt: Date;
  userRole: Role;
};
type SessionData = {
  userId: string;
  userRole: Role;
  expiresAt: string;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined = "",
): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });

    return payload as SessionData;
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete("session");
}
