"use client";

import Link from "next/link";
import { useActionState, useState, useEffect } from "react";
import { ActionState, login } from "./actions";
import { useFormStatus } from "react-dom";
import ReCAPTCHA from "react-google-recaptcha";

export default function Login() {
  const [state, loginAction] = useActionState<ActionState, FormData>(
    login,
    undefined,
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [envKey, setEnvKey] = useState<string>("");
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    setEnvKey(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "");
    console.log("Client-side Site Key:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  }, []);

  const onCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-green-700">🌱 FarmCoop</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>
        <form className="space-y-4" action={loginAction}>
          <div>
            {state?.errors?.username?.[0] && (
              <p className="text-red-500 text-sm">{state.errors.username[0]}</p>
            )}
            <input
              name="username"
              type="text"
              placeholder="Email address"
              className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            {state?.errors?.password?.[0] && (
              <p className="text-red-500 text-sm">{state.errors.password[0]}</p>
            )}
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="flex justify-center py-2" style={{ minHeight: '78px' }}>
            {isMounted && (
              <ReCAPTCHA
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
                onChange={onCaptchaChange}
              />
            )}
            <input type="hidden" name="captchaToken" value={captchaToken || ""} />
          </div>
          {state?.errors?.captchaToken?.[0] && (
            <p className="text-red-500 text-sm text-center">
              {state.errors.captchaToken[0]}
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <Link href="#" className="text-green-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          <SubmitButton />
        </form>

        <p className="text-sm text-center mt-6 text-gray-600">
          Don’t have an account?{" "}
          <Link href="/signup" className="text-green-600 font-medium">
            Sign up
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 transition font-medium"
    >
      {pending ? "Signing in..." : "Sign In"}
    </button>
  );
}
