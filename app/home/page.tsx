import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import styles from "./home.module.css";

const services = [
  ["01", "Cash loans", "Request a loan and follow its review and repayment."],
  ["02", "Farm supplies", "Ask for the seeds, fertilizer, and supplies your work needs."],
  ["03", "Machinery", "Reserve shared equipment and keep track of your rental."],
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/home" className={styles.brand} aria-label="FarmCoop home">
          <span className={styles.brandMark}>FC</span>
          <span className={styles.brandName}>FarmCoop<small>Farmers&apos; cooperative</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#services">What we offer</a>
          <Link href="/login">Member sign in</Link>
          <Link href="/signup" className={styles.navJoin}>Apply to join <ArrowUpRight size={16} /></Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>For the people who work the land</p>
          <h1 id="hero-title">Better tools.<br />Stronger farms.<br /><em>Shared ground.</em></h1>
          <p className={styles.intro}>A place to find the support behind your work: farm supplies, shared machinery, cash loans, and fellow members.</p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.primaryAction}>Apply for membership <ArrowUpRight size={19} /></Link>
            <Link href="/login" className={styles.textAction}>Already a member? Sign in <ArrowUpRight size={17} /></Link>
          </div>
          <a href="#services" className={styles.scrollCue}>See what members can do <ArrowDownRight size={17} /></a>
        </div>
        <div className={styles.heroImage}>
          <Image src="/farm.webp" alt="Green rice field with trees along its edge" fill priority sizes="(max-width: 800px) 100vw, 53vw" className={styles.photo} />
          <div className={styles.imageLabel}><strong>FarmCoop</strong><span>Grow with your cooperative</span></div>
        </div>
      </section>

      <section id="services" className={styles.services} aria-labelledby="services-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Member services</p>
          <h2 id="services-title">Useful help, all in one place.</h2>
          <p>Apply, request, reserve, and keep track of what matters to your farm.</p>
        </div>
        <div className={styles.serviceList}>
          {services.map(([number, title, detail]) => (
            <div className={styles.service} key={number}>
              <span className={styles.serviceNumber}>{number}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
              <ArrowUpRight className={styles.serviceArrow} size={22} aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.join} aria-labelledby="join-title">
        <div><p className={styles.eyebrow}>Membership</p><h2 id="join-title">There&apos;s room to grow together.</h2></div>
        <Link href="/signup" className={styles.joinAction}>Start your application <ArrowUpRight size={19} /></Link>
      </section>

      <footer className={styles.footer}>
        <span>FarmCoop</span><span>Farmers&apos; Cooperative Management System</span>
        <Link href="/login">Member sign in <ArrowUpRight size={14} /></Link>
      </footer>
    </main>
  );
}
