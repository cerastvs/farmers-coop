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
    <div className="min-h-screen flex items-center justify-center bg-[#f0f9f4] relative overflow-hidden px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-200/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/50 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/20 relative z-10 transition-all duration-300 font-sans">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4 shadow-inner">
            <span className="text-3xl">🌱</span>
          </div>
          <h1 className="text-3xl font-extrabold text-green-900 tracking-tight">
            FarmCoop
          </h1>
          <p className="text-green-700/60 font-medium mt-2">
            Join our growing community
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-green-800/70 ml-1 uppercase tracking-wider">
              Username
            </label>
            <input
              name="username"
              placeholder="e.g. janesmith"
              className={`w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400 ${
                errors.username
                  ? "border-red-300 bg-red-50/50 ring-4 ring-red-500/10"
                  : ""
              }`}
            />
            {errors.username && (
              <p className="text-red-500 text-xs font-medium mt-1 ml-1">
                {errors.username}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-green-800/70 ml-1 uppercase tracking-wider">
              Password
            </label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className={`w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400 ${
                errors.password
                  ? "border-red-300 bg-red-50/50 ring-4 ring-red-500/10"
                  : ""
              }`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs font-medium mt-1 ml-1">
                {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-green-800/70 ml-1 uppercase tracking-wider">
              Confirm Password
            </label>
            <input
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              className={`w-full px-5 py-3.5 bg-white/50 border border-green-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all placeholder:text-gray-400 ${
                errors.confirmPassword
                  ? "border-red-300 bg-red-50/50 ring-4 ring-red-500/10"
                  : ""
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs font-medium mt-1 ml-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-4 rounded-2xl hover:bg-green-700 active:scale-[0.98] transition-all font-bold shadow-lg shadow-green-200 mt-2"
          >
            Create Account
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-green-100/50 flex flex-col gap-4 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-green-600 font-bold hover:text-green-700 transition-colors"
            >
              Log in here
            </Link>
          </p>

          <Link
            href="/"
            className="text-xs font-semibold text-gray-400 hover:text-green-600 uppercase tracking-widest transition-colors inline-block"
          >
            ← Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
