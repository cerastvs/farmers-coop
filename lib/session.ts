import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Session } from "inspector/promises";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, expiresAt });

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
      "expiresAt" in data
    ) {
      const userId = (data as { userId: string; expiresAt: string | Date })
        .userId;
      const expiresAt = new Date(
        (data as { userId: string; expiresAt: string | Date }).expiresAt,
      );

      if (expiresAt < new Date()) return null;

      return { userId };
    }

    return null;
  } catch (err) {
    console.error("Failed to decrypt session:", err);
    return null;
  }
}

type SessionData = {
  userId: string;
  expiresAt: string;
};

type SessionPayload = {
  userId: string;
  expiresAt: Date;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.log("Failed to verify session");
  }
}
