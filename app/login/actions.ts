"use server";

import prisma from "@/lib/client";
import { createSession } from "@/lib/session";
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
});
export async function login(prevState: any, formData: FormData) {
  const result = LoginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { username, password } = result.data;

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

  await createSession(user.id, user.role);

  redirect("/dashboard");
}

export async function logout() {}
