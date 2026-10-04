"use client";
import { RegistrationSchema } from "@/lib/validators/signup";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import styles from "../auth.module.css";
import { useState } from "react";
import { login } from "../login/actions";

export default function SignUp() {
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

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
        confirmPassword: data.confirmPassword,
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

    setCredentials({ username: data.username, password: data.password });
    setShowSuccess(true);
  };

  async function handleContinue() {
    if (!credentials) return;
    setPending(true);
    const formData = new FormData();
    formData.append("username", credentials.username);
    formData.append("password", credentials.password);
    await login(undefined, formData);
  }

  return (
    <main className={styles.scene}>
      <div className={styles.visual}>
        <Image src="/farm.webp" alt="Rice field on a working farm" fill priority sizes="(max-width: 800px) 100vw, 52vw" className={styles.photo} />
        <div className={styles.visualContent}>
          <Link href="/home" className={styles.brand}><span className={styles.brandMark}>FC</span>FarmCoop</Link>
          <div className={styles.visualMessage}><span>Farmers&apos; cooperative</span><p>There is room to grow here.</p></div>
        </div>
      </div>
      <div className={styles.formSide}>
        <Link href="/home" className={styles.topLink}><ArrowLeft size={16} /> Back to home</Link>
        <div className={styles.formContent}>
          <p className={styles.eyebrow}>New member</p>
          <h1 className={styles.title}>Join FarmCoop.</h1>
          <p className={styles.subtitle}>Create an account to begin your membership application.</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="signup-username" className={styles.label}>Username</label>
              <input id="signup-username" name="username" autoComplete="username" placeholder="Choose a username" className={`${styles.input} ${errors.username ? styles.inputError : ""}`} />
              {errors.username && <p className={styles.error}>{errors.username}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="signup-password" className={styles.label}>Password</label>
              <input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" className={`${styles.input} ${errors.password ? styles.inputError : ""}`} />
              {errors.password && <p className={styles.error}>{errors.password}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="signup-confirm" className={styles.label}>Confirm password</label>
              <input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`} />
              {errors.confirmPassword && <p className={styles.error}>{errors.confirmPassword}</p>}
            </div>
            <button type="submit" className={styles.submit}>Create account <ArrowUpRight size={18} /></button>
          </form>
          <p className={styles.switch}>Already a member? <Link href="/login" className={styles.switchLink}>Sign in</Link></p>
        </div>
      </div>
      {showSuccess && (
        <div className={styles.overlay}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
            <span className={styles.dialogMark}>FC</span>
            <h2 id="signup-success-title">Account created.</h2>
            <p>Your account is ready. Continue to your membership application.</p>
            <button onClick={handleContinue} disabled={pending} className={styles.submit}>
              {pending ? "Logging in…" : "Continue to registration"}<ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
