"use client";

import Link from "next/link";
import { useActionState, useState, useEffect } from "react";
import { ActionState, login } from "./actions";
import { useFormStatus } from "react-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { ArrowLeft, Sprout } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#edf5df] px-4 py-10">
      <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-[#badb94]/50 blur-3xl" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-[#86b87b]/35 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-7 shadow-2xl shadow-[#173a2b]/15 backdrop-blur-md sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#174b36] text-[#d6ed9f]"><Sprout size={24} /></div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#173a2b]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#718176]">Sign in to your FarmCoop account</p>
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
              className="w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-4 py-3 text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35"
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
              className="w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-4 py-3 text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35"
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
            <Link href="#" className="font-semibold text-[#39733e] hover:underline">
              Forgot password?
            </Link>
          </div>

          <SubmitButton />
        </form>

        <p className="mt-7 text-center text-sm text-[#718176]">
          Don’t have an account?{" "}
          <Link href="/signup" className="font-bold text-[#39733e]">
            Sign up
          </Link>
        </p>

        <div className="mt-5 text-center">
          <Link href="/home" className="inline-flex items-center gap-1 text-sm font-semibold text-[#718176] hover:text-[#39733e]">
            <ArrowLeft size={15} /> Back to home
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
      className="w-full rounded-xl bg-[#174b36] py-3.5 font-bold text-white shadow-lg shadow-[#174b36]/15 transition hover:bg-[#0e3b2a] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign In"}
    </button>
  );
}
