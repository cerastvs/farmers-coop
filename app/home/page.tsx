import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <h1 className="text-xl font-bold text-green-700">FarmCoop</h1>
        <div className="hidden md:flex gap-3">
          <Link href="/login" className="px-4 py-2 border rounded-lg">
            Login
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-green-600 text-white rounded-lg"
          >
            Join Now
          </Link>
        </div>
      </nav>

      <section className="relative h-[80vh] flex items-center">
        <Image
          src="/farm.jpg"
          alt="Farm"
          fill
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 px-6 md:px-16 text-white max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Empowering Farmers Through{" "}
            <span className="text-green-400">Collaboration</span>
          </h1>
          <p className="mt-4 text-lg text-gray-200">
            Join our cooperative to access loans, rent machinery, purchase
            farming supplies, and grow your agricultural business together.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <Link
              href="/signup"
              className="bg-green-600 px-6 py-3 rounded-lg text-center"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="bg-white text-green-700 px-6 py-3 rounded-lg text-center"
            >
              Member Login
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-16 py-16 bg-gray-50">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Why Join Our Cooperative?</h2>
          <p className="text-gray-500 mt-2">
            Everything you need to succeed in farming
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="w-10 h-10 bg-green-100 text-green-600 flex items-center justify-center rounded-lg mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-gray-500 mt-2 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-green-700 text-white text-center py-16 px-6">
        <h2 className="text-3xl font-bold">Ready to Grow Your Farm?</h2>
        <p className="mt-2 text-green-100">
          Join hundreds of farmers already benefiting from our cooperative
        </p>

        <Link
          href="/register"
          className="inline-block mt-6 bg-white text-green-700 px-6 py-3 rounded-lg"
        >
          Apply for Membership
        </Link>
      </section>

      <footer className="bg-slate-900 text-white text-center py-6">
        <p className="font-semibold">FarmCoop</p>
        <p className="text-sm text-gray-400 mt-2">
          © 2026 Farmers' Cooperative Management System. All rights reserved.
        </p>
      </footer>
    </main>
  );
}

const features = [
  {
    title: "Cash Loans",
    desc: "Access affordable loans with flexible terms to invest in your farm.",
    icon: "$",
  },
  {
    title: "Machinery Rental",
    desc: "Rent modern farming equipment at competitive rates.",
    icon: "🚜",
  },
  {
    title: "Farming Supplies",
    desc: "Purchase or loan quality seeds and fertilizers.",
    icon: "🌱",
  },
  {
    title: "Community Support",
    desc: "Connect with fellow farmers and grow together.",
    icon: "👥",
  },
  {
    title: "Financial Growth",
    desc: "Track finances and achieve sustainable growth.",
    icon: "📈",
  },
  {
    title: "Secure & Transparent",
    desc: "Enjoy secure record-keeping and fair management.",
    icon: "🛡️",
  },
];
