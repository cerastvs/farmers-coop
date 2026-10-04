import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./member.module.css";

export function MemberPageHeader({ title, description, indicator }: { title: string; description: string; indicator?: React.ReactNode }) {
  return (
    <header className={styles.heading}>
      <Link href="/dashboard" className={styles.back}><ArrowLeft size={15} /> Dashboard</Link>
      <p className={styles.eyebrow}>Member workspace</p>
      <h1 className={styles.title}>{title}{indicator}</h1>
      <p className={styles.description}>{description}</p>
    </header>
  );
}
