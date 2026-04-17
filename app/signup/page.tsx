"use client";
import { RegistrationSchema } from "@/lib/validators/signup";
import Link from "next/link";
import { useState } from "react";

export default function SignUp() {
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = RegistrationSchema.safeParse(data);

    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof typeof fieldErrors;
        fieldErrors[field] = err.message;
      });

      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    const res = await fetch("/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: data.username,
        password: data.password,
      }),
    });
    const responseData = await res.json();

    if (!res.ok) {
      setErrors((prev) => ({
        ...prev,
        username: responseData.error,
      }));
      return;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-green-700">🌱 FarmCoop</h1>
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <input
              name="username"
              placeholder="Username"
              className={`w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.username ? "ring-2 ring-red-500" : ""
                }`}
            />
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <input
              name="password"
              type="password"
              placeholder="Password"
              className={`w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.password ? "ring-2 ring-red-500" : ""
                }`}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              className={`w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.confirmPassword ? "ring-2 ring-red-500" : ""
                }`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 transition font-medium"
          >
            Sign Up
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-green-600 font-medium">
            Log in
          </Link>
        </p>

        <div className="text-center mt-4">
          <Link href="/" className="text-gray-400 text-sm hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
