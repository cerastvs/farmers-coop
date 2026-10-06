"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { useActionState } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionState, login } from "./actions";
import styles from "../auth.module.css";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, loginAction] = useActionState<ActionState, FormData>(
    login,
    undefined,
  );

  return (
    <main className={styles.scene}>
      <div className={styles.visual}>
        <Image src="/farm.webp" alt="Rice field on a working farm" fill priority sizes="(max-width: 800px) 100vw, 52vw" className={styles.photo} />
        <div className={styles.visualContent}>
          <Link href="/home" className={styles.brand}><span className={styles.brandMark}>FC</span>FarmCoop</Link>
          <div className={styles.visualMessage}><span>Farmers&apos; cooperative</span><p>Good work grows stronger together.</p></div>
        </div>
      </div>
      <div className={styles.formSide}>
        <Link href="/home" className={styles.topLink}><ArrowLeft size={16} /> Back to home</Link>
        <div className={styles.formContent}>
          <p className={styles.eyebrow}>Member access</p>
          <h1 className={styles.title}>Welcome back.</h1>
          <p className={styles.subtitle}>Sign in to your FarmCoop account.</p>
          <form className={styles.form} action={loginAction}>
            {state?.message && <p role="alert" className={styles.formMessage}>{state.message}</p>}
            <div className={styles.field}>
              <label htmlFor="login-username" className={styles.label}>Username</label>
              <input id="login-username" name="username" type="text" autoComplete="username" placeholder="Enter your username" className={styles.input} />
              {state?.errors?.username?.[0] && <p className={styles.error}>{state.errors.username[0]}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="login-password" className={styles.label}>Password</label>
              <div className={styles.passwordField}>
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className={`${styles.input} ${styles.passwordInput}`} />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {state?.errors?.password?.[0] && <p className={styles.error}>{state.errors.password[0]}</p>}
            </div>
            <Link href="#" className={styles.forgot}>Forgot password?</Link>
            <SubmitButton />
          </form>
          <p className={styles.switch}>New to the cooperative? <Link href="/signup" className={styles.switchLink}>Create an account</Link></p>
        </div>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={styles.submit}>
      {pending ? "Signing in..." : "Sign in"}<ArrowUpRight size={18} />
    </button>
  );
}
