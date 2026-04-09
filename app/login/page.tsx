"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";
import { useFormStatus } from "react-dom";

export default function Login() {
  const [state, loginAction] = useActionState(login, undefined);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome back</h1>

        <form className="space-y-4" action={loginAction}>
          <div>
            {state?.errors?.username?.[0] && (
              <p className="text-red-500 text-sm">{state.errors.username[0]}</p>
            )}
            <label className="block text-sm font-medium mb-1">username</label>
            <input
              name="username"
              type="text"
              placeholder="you@example.com"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            {state?.errors?.username?.[0] && (
              <p className="text-red-500 text-sm">{state.errors.username[0]}</p>
            )}
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <SubmitButton />
        </form>

        <p className="text-sm text-center mt-4">
          Don’t have an account?{" "}
          <Link href="/signup" className="text-black font-medium underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
    >
      Log in
    </button>
  );
}
