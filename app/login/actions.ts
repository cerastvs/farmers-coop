"use server";

import prisma from "@/lib/client";
import { writeActivityLog } from "@/lib/activity";
import { createSession, deleteSession, getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

const sanitizeSql = (val: string) => {
  return val
    .replace(/;/g, "")
    .replace(/--/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'/g, "''");
};

const LoginSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username is too long")
    .trim()
    .transform(sanitizeSql),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),

  // captchaToken: z.string().min(1, "Please complete the reCAPTCHA"),
  captchaToken: z.string().optional(),
});

export type ActionState =
  | {
    errors?: {
      username?: string[];
      password?: string[];
      captchaToken?: string[];
    };
    message?: string;
  }
  | undefined;

export async function login(prevState: ActionState, formData: FormData) {
  const result = LoginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { username, password } = result.data;

  // const isCaptchaValid = await verifyCaptcha(captchaToken);
  // if (!isCaptchaValid) {
  //   return {
  //     errors: {
  //       captchaToken: ["reCAPTCHA verification failed. Please try again."],
  //     },
  //   };
  // }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    await writeActivityLog({
      action: "LOGIN",
      success: false,
      info: `Login failed for unknown username ${username}`,
    });
    return { errors: { username: ["User not found"] } };
  }

  // The password is checked before anything else that could hand out a
  // session, so knowing a disabled account's username gets an attacker nothing.
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    await writeActivityLog({
      userId: user.id,
      action: "LOGIN",
      success: false,
      info: "Login failed because the password was invalid",
    });
    return { errors: { password: ["Invalid password"] } };
  }

  const application = await prisma.application.findFirst({
    where: { userId: user.id },
  });

  // A disabled account still signs in, but only far enough to read the notice
  // page explaining why it was disabled and to ask for it back. Refusing the
  // login outright would leave that page unreachable — the session is what gets
  // someone to it. It grants no access: every API still rejects an inactive
  // account, and the dashboard layout redirects it here on first load.
  if (!user.active) {
    await createSession(user.id, user.role, !!application);
    await writeActivityLog({
      userId: user.id,
      action: "LOGIN",
      success: true,
      info: "Signed in to a disabled account to view the notice page",
    });
    redirect("/account-disabled");
  }

  await createSession(user.id, user.role, !!application);
  await writeActivityLog({
    userId: user.id,
    action: "LOGIN",
    success: true,
    info: "User logged in",
  });

  if (!application) {
    redirect("/registration");
  }

  if (user.role === "SECRETARY") redirect("/dashboard/secretary");
  if (user.role === "TREASURER") redirect("/dashboard/treasurer");
  if (user.role === "PRESIDENT") redirect("/dashboard/president");
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  await deleteSession();
  await writeActivityLog({
    userId: session?.userId,
    action: "LOGOUT",
    success: true,
    info: "User logged out",
  }).catch((error) => {
    console.error("Failed to write logout activity", error);
  });
  redirect("/login");
}
