"use server";

import prisma from "@/lib/client";
import { createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

const LoginSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username is too long")
    .trim(),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),

  captchaToken: z.string().min(1, "Please complete the reCAPTCHA"),
});

async function verifyCaptcha(token: string) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error("RECAPTCHA_SECRET_KEY is not set");
    return false;
  }

  const response = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`,
    { method: "POST" },
  );

  const data = await response.json();
  return data.success;
}

export async function login(prevState: any, formData: FormData) {
  const result = LoginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { username, password, captchaToken } = result.data;

  const isCaptchaValid = await verifyCaptcha(captchaToken);
  if (!isCaptchaValid) {
    return {
      errors: { captcha: ["reCAPTCHA verification failed. Please try again."] },
    };
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    return { errors: { username: ["User not found"] } };
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return { errors: { password: ["Invalid password"] } };
  }

  const application = await prisma.application.findFirst({
    where: { userId: user.id },
  });

  await createSession(user.id, user.role, !!application);

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
