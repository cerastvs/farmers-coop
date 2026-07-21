import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Handshake, Landmark, Sprout, Tractor, UsersRound } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7f2] text-[#173a2b]">
      <nav className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/home" className="flex items-center gap-2.5 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9e590] text-[#174b36] shadow-lg shadow-black/10"><Sprout size={22} /></span>
          <span className="text-xl font-extrabold tracking-tight">FarmCoop</span>
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#d6ed9f] px-5 py-2.5 text-sm font-bold text-[#174b36] shadow-lg shadow-black/10 transition hover:bg-white"
          >
            Join Now
          </Link>
        </div>
      </nav>

      <section className="relative flex min-h-[710px] items-end md:min-h-[760px] md:items-center">
        <Image
          src="/farm.webp"
          alt="Farm"
          fill
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,48,34,.88)_0%,rgba(14,65,43,.68)_48%,rgba(8,34,23,.24)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f7f7f2] to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-28 pt-32 text-white lg:px-8 md:py-32">
          <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#e5f5bb] backdrop-blur-sm"><Handshake size={15} /> Stronger together</p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
            The future of farming is <span className="text-[#d6ed9f]">shared.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/85 md:text-xl">
            Access fair financing, reliable equipment, and a community that puts your farm&apos;s growth first.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d6ed9f] px-7 py-3.5 text-center font-bold text-[#174b36] transition hover:bg-white"
            >
              Become a member <ArrowRight size={17} />
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-center font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Member Login
            </Link>
          </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-11 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4f7e38]">Built for the farm</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#173a2b]">The support behind every good season.</h2>
          </div>
          <p className="max-w-sm text-base leading-7 text-[#5b6e62]">
            Practical services, transparent records, and a network that understands agricultural work.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="group rounded-2xl border border-[#e2e7dc] bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#b9d59c] hover:shadow-xl hover:shadow-[#234f39]/[.08]">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[#edf5df] text-[#39733e] transition group-hover:bg-[#39733e] group-hover:text-white">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-[#173a2b]">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66776c]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-3xl bg-[#174b36] px-8 py-10 text-white md:flex-row md:items-center md:px-12 md:py-12">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#d6ed9f]">Membership is open</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Your next growing season starts here.</h2>
            <p className="mt-3 text-white/75">Join a cooperative designed around the realities of farming.</p>
          </div>
          <Link href="/signup" className="shrink-0 rounded-full bg-[#d6ed9f] px-6 py-3 font-bold text-[#174b36] transition hover:bg-white">Apply for membership</Link>
        </div>
      </section>

      <footer className="border-t border-[#e2e7dc] px-6 py-8 text-center text-[#65756a]">
        <p className="font-bold text-[#173a2b]">FarmCoop</p>
        <p className="mt-2 text-sm">
          © 2026 Farmers&apos; Cooperative Management System. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

const features = [
  {
    title: "Cash Loans",
    desc: "Access affordable loans with flexible terms to invest in your farm.",
    icon: <Landmark size={22} />,
  },
  {
    title: "Machinery Rental",
    desc: "Rent modern farming equipment at competitive rates.",
    icon: <Tractor size={22} />,
  },
  {
    title: "Farming Supplies",
    desc: "Purchase or loan quality seeds and fertilizers.",
    icon: <Sprout size={22} />,
  },
  {
    title: "Community Support",
    desc: "Connect with fellow farmers and grow together.",
    icon: <UsersRound size={22} />,
  },
  {
    title: "Financial Growth",
    desc: "Track finances and achieve sustainable growth.",
    icon: <BadgeCheck size={22} />,
  },
  {
    title: "Secure & Transparent",
    desc: "Enjoy secure record-keeping and fair management.",
    icon: <BadgeCheck size={22} />,
  },
];
