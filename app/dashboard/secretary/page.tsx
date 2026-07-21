"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "../components/DashboardHeader";
import { SummaryCard } from "../components/SummaryCard";
import { IconLoan, IconMachine } from "@/components/icons";
import {
  FileText,
  Users,
  Package,
  Tractor,
  ChevronDown,
  ChevronUp,
  Banknote,
} from "lucide-react";

interface Application {
  id: string;
  name: string;
  date: string;
  crop: string;
  status: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  joined: string;
  farm: string | null;
}

interface Loan {
  id: string;
  borrower: string;
  name: string;
  amount: number;
  status: string;
  due: string | null;
}

interface Machine {
  id: string;
  name: string;
  description: string | null;
  total: number;
  borrowed: number;
  borrowedBy: string[];
}

interface Supply {
  id: string;
  name: string;
  stock: number;
  price: number;
}

interface SecretaryData {
  summary: {
    pendingApplicationsCount: number;
    activeLoansCount: number;
    totalBorrowedMachines: number;
    totalMembers: number;
  };
  applications: Application[];
  members: Member[];
  loans: Loan[];
  machines: Machine[];
  supplies: Supply[];
}

const LOAN_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  PAID: "bg-gray-100 text-gray-500",
  REJECTED: "bg-red-100 text-red-600",
};

const SECTIONS = [
  "applications",
  "members",
  "loans",
  "machines",
  "supplies",
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_META: Record<
  Section,
  {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    accent: string;
    iconBg: string;
  }
> = {
  applications: { label: "Applications", icon: FileText, accent: "border-l-yellow-400", iconBg: "bg-yellow-100 text-yellow-600" },
  members: { label: "Members", icon: Users, accent: "border-l-purple-400", iconBg: "bg-purple-100 text-purple-600" },
  loans: { label: "Loans", icon: Banknote, accent: "border-l-green-400", iconBg: "bg-green-100 text-green-600" },
  machines: { label: "Machines", icon: Tractor, accent: "border-l-blue-400", iconBg: "bg-blue-100 text-blue-600" },
  supplies: { label: "Supplies", icon: Package, accent: "border-l-orange-400", iconBg: "bg-orange-100 text-orange-600" },
};

const VISIBLE_COUNT = 3;

function SectionCard({
  section,
  count,
  expanded,
  onToggle,
  children,
}: {
  section: Section;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  return (
    <div className={`flex flex-col rounded-2xl border border-[#e2e7dc] bg-white shadow-sm shadow-[#173a2b]/[.03] overflow-hidden border-l-4 ${meta.accent} lg:h-[400px]`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-gray-50/50 active:scale-[0.995]"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 ${meta.iconBg}`}>
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#173a2b]">{meta.label}</h3>
            <p className="text-xs text-[#718176]">
              {count} total
              {!expanded && count > VISIBLE_COUNT && ` · Showing ${VISIBLE_COUNT}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#edf5df] px-2.5 py-0.5 text-[11px] font-bold text-[#39733e]">
            {count}
          </span>
          <div className="rounded-lg bg-gray-100 p-1.5 text-gray-400">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>
      <div className="flex-1 border-t border-[#f0f3ed] px-5 py-3 space-y-2 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d5ddd0] bg-[#fafdf7] p-6 text-center text-xs text-[#718176]">
      {text}
    </div>
  );
}

function ApplicationsSection({
  items,
  expanded,
  onToggle,
}: {
  items: Application[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard section="applications" count={items.length} expanded={expanded} onToggle={onToggle}>
      {visible.length > 0 ? (
        visible.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#173a2b] truncate">
                {app.name}
              </p>
              <p className="text-xs text-[#718176]">
                {app.crop} · Applied{" "}
                {new Date(app.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <span className="shrink-0 ml-3 rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-bold text-yellow-700">
              Pending
            </span>
          </div>
        ))
      ) : (
        <EmptyState text="No pending applications" />
      )}
    </SectionCard>
  );
}

function MembersSection({
  items,
  expanded,
  onToggle,
}: {
  items: Member[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard section="members" count={items.length} expanded={expanded} onToggle={onToggle}>
      {visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                {m.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#173a2b] truncate">
                  {m.name}
                </p>
                <p className="text-[11px] text-[#718176] truncate">
                  {m.farm || "No farm info"}
                </p>
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    m.role === "PRESIDENT"
                      ? "bg-red-100 text-red-600"
                      : m.role === "TREASURER"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No members found" />
      )}
    </SectionCard>
  );
}

function LoansSection({
  items,
  expanded,
  onToggle,
}: {
  items: Loan[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard section="loans" count={items.length} expanded={expanded} onToggle={onToggle}>
      {visible.length > 0 ? (
        visible.map((loan) => (
          <div
            key={loan.id}
            className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    {loan.borrower}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${LOAN_STATUS_STYLE[loan.status] || ""}`}
                  >
                    {loan.status}
                  </span>
                </div>
                <p className="text-xs text-[#718176] mt-0.5">
                  {loan.name} · ₱{loan.amount.toLocaleString()}
                  {loan.due &&
                    ` · Due ${new Date(loan.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                </p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState text="No loans found" />
      )}
    </SectionCard>
  );
}

function MachinesSection({
  items,
  expanded,
  onToggle,
}: {
  items: Machine[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard section="machines" count={items.length} expanded={expanded} onToggle={onToggle}>
      {visible.length > 0 ? (
        visible.map((machine) => {
          const isAvailable = machine.borrowed === 0;
          return (
            <div
              key={machine.id}
              className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#173a2b] truncate">
                      {machine.name}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isAvailable
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {isAvailable
                        ? "Available"
                        : `${machine.borrowed}/${machine.total} borrowed`}
                    </span>
                  </div>
                  {!isAvailable && (
                    <p className="text-xs text-[#718176] mt-1 truncate">
                      Borrowed by: {machine.borrowedBy.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <EmptyState text="No machines found" />
      )}
    </SectionCard>
  );
}

function SuppliesSection({
  items,
  expanded,
  onToggle,
}: {
  items: Supply[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard section="supplies" count={items.length} expanded={expanded} onToggle={onToggle}>
      {visible.length > 0 ? (
        visible.map((supply) => (
          <div
            key={supply.id}
            className="flex items-center justify-between rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#173a2b] truncate">
                {supply.name}
              </p>
              <p className="text-xs text-[#718176]">
                ₱{supply.price.toLocaleString()} per unit
              </p>
            </div>
            <span
              className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                supply.stock === 0
                  ? "bg-red-100 text-red-600"
                  : supply.stock <= 30
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {supply.stock === 0
                ? "Out of stock"
                : `${supply.stock} in stock`}
            </span>
          </div>
        ))
      ) : (
        <EmptyState text="No supplies found" />
      )}
    </SectionCard>
  );
}

export default function SecretaryDashboard() {
  const [data, setData] = useState<SecretaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<
    Record<Section, boolean>
  >({
    applications: false,
    members: false,
    loans: false,
    machines: false,
    supplies: false,
  });
  const [activeTab, setActiveTab] = useState<Section>("applications");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/secretary/stats");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch secretary data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  function toggleSection(section: Section) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#39733e]"></div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Pending Applications",
      value: data?.summary.pendingApplicationsCount.toString() || "0",
      icon: <FileText size={20} />,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
    {
      label: "Active Loans",
      value: data?.summary.activeLoansCount.toString() || "0",
      icon: <IconLoan />,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Machines Borrowed",
      value: data?.summary.totalBorrowedMachines.toString() || "0",
      icon: <IconMachine />,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Members",
      value: data?.summary.totalMembers.toString() || "0",
      icon: <Users size={20} />,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  const sections: { key: Section; component: React.ReactNode }[] = [
    {
      key: "applications",
      component: (
        <ApplicationsSection
          items={data?.applications || []}
          expanded={expandedSections.applications}
          onToggle={() => toggleSection("applications")}
        />
      ),
    },
    {
      key: "members",
      component: (
        <MembersSection
          items={data?.members || []}
          expanded={expandedSections.members}
          onToggle={() => toggleSection("members")}
        />
      ),
    },
    {
      key: "loans",
      component: (
        <LoansSection
          items={data?.loans || []}
          expanded={expandedSections.loans}
          onToggle={() => toggleSection("loans")}
        />
      ),
    },
    {
      key: "machines",
      component: (
        <MachinesSection
          items={data?.machines || []}
          expanded={expandedSections.machines}
          onToggle={() => toggleSection("machines")}
        />
      ),
    },
    {
      key: "supplies",
      component: (
        <SuppliesSection
          items={data?.supplies || []}
          expanded={expandedSections.supplies}
          onToggle={() => toggleSection("supplies")}
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col">
      <DashboardHeader />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4f7e38]">
            Secretary Portal
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#173a2b]">
            Secretary Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#718176]">
            Manage applications, members, loans, machines, and supplies
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {SECTIONS.map((section) => {
              const meta = SECTION_META[section];
              const Icon = meta.icon;
              return (
                <button
                  key={section}
                  onClick={() => setActiveTab(section)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                    activeTab === section
                      ? "bg-[#174b36] text-white shadow-md"
                      : "bg-white text-[#315646] border border-[#e2e7dc]"
                  }`}
                >
                  <Icon size={14} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: Single active section */}
        <div className="lg:hidden">
          {sections.find((s) => s.key === activeTab)?.component}
        </div>

        {/* Desktop: All sections in 2-column grid */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-4">
          {sections.map((s) => (
            <div key={s.key}>{s.component}</div>
          ))}
        </div>

        <div className="h-4" />
      </main>
    </div>
  );
}
