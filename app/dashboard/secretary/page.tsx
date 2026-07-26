"use client";

import { useEffect, useState, useRef } from "react";
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
  Plus,
  Pencil,
  Trash2,
  X,
  ImagePlus,
  CheckCircle,
  Phone,
  MapPin,
  Wheat,
  Calendar,
} from "lucide-react";

interface Application {
  id: string;
  fullName: string;
  age: number;
  gender: string;
  address: string;
  contact: string;
  farmSize: number;
  cropType: string;
  yearsFarming: number;
  validIdUrl: string;
  proofOfFarmUrl: string;
  status: string;
  createdAt: string;
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
  imageUrl: string | null;
  isBorrowed: boolean;
  borrowedBy: string[];
  currentUsage: {
    name: string;
    startDate: string | null;
    endDate: string | null;
  }[];
  requests: MachineRequestInfo[];
}

interface MachineRequestInfo {
  id: string;
  status: string;
  rejectionReason: string | null;
  requestDate: string;
  startDate: string | null;
  endDate: string | null;
  returnedAt: string | null;
  startedAt: string | null;
  member: {
    id: string;
    name: string;
    email: string;
    contact: string | null;
    address: string | null;
    farmSize: number | null;
    cropType: string | null;
    yearsFarming: number | null;
  };
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

const APP_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
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
type MachineRequestAction =
  | "approve"
  | "reject"
  | "start"
  | "return"
  | "overdue"
  | "remind"
  | "rejectReturn";

const SECTION_META: Record<
  Section,
  {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    accent: string;
    iconBg: string;
  }
> = {
  applications: {
    label: "Applications",
    icon: FileText,
    accent: "border-l-yellow-400",
    iconBg: "bg-yellow-100 text-yellow-600",
  },
  members: {
    label: "Members",
    icon: Users,
    accent: "border-l-purple-400",
    iconBg: "bg-purple-100 text-purple-600",
  },
  loans: {
    label: "Loans",
    icon: Banknote,
    accent: "border-l-green-400",
    iconBg: "bg-green-100 text-green-600",
  },
  machines: {
    label: "Machines",
    icon: Tractor,
    accent: "border-l-blue-400",
    iconBg: "bg-blue-100 text-blue-600",
  },
  supplies: {
    label: "Supplies",
    icon: Package,
    accent: "border-l-orange-400",
    iconBg: "bg-orange-100 text-orange-600",
  },
};

const VISIBLE_COUNT = 3;

function SectionCard({
  section,
  count,
  expanded,
  onToggle,
  headerAction,
  children,
}: {
  section: Section;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-[#e2e7dc] bg-white shadow-sm shadow-[#173a2b]/[.03] overflow-hidden border-l-4 ${meta.accent} lg:h-[400px]`}
    >
      <div className="flex w-full items-center justify-between gap-3 px-5 py-4 transition hover:bg-gray-50/50">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.995]"
        >
          <div className={`rounded-xl p-2.5 ${meta.iconBg}`}>
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#173a2b]">{meta.label}</h3>
            <p className="text-xs text-[#718176]">
              {count} total
              {!expanded &&
                count > VISIBLE_COUNT &&
                ` · Showing ${VISIBLE_COUNT}`}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {headerAction}
          <span className="rounded-full bg-[#edf5df] px-2.5 py-0.5 text-[11px] font-bold text-[#39733e]">
            {count}
          </span>
          <button
            onClick={onToggle}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${meta.label}`}
            className="rounded-lg bg-gray-100 p-1.5 text-gray-400"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
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

function MachineDetailModal({
  machine,
  onClose,
  onEdit,
  onDelete,
  onViewRequest,
  onViewRejected,
  onLifecycle,
}: {
  machine: Machine;
  onClose: () => void;
  onEdit: (m: Machine) => void;
  onDelete: (m: Machine) => void;
  onViewRequest: (request: MachineRequestInfo) => void;
  onViewRejected: (request: MachineRequestInfo) => void;
  onLifecycle: (
    requestId: string,
    action: MachineRequestAction,
    message?: string,
  ) => void;
}) {
  const [rejectedExpanded, setRejectedExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [expiredExpanded, setExpiredExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    requestId: string;
    action: MachineRequestAction;
    title: string;
    message: string;
    confirmLabel: string;
  } | null>(null);
  const [machineActionBusy, setMachineActionBusy] = useState(false);

  const pending = machine.requests?.filter((r) => r.status === "QUEUED") ?? [];
  const returnPending = machine.requests?.filter((r) => r.status === "RETURN_PENDING") ?? [];
  const allApproved =
    machine.requests?.filter(
      (r) => r.status === "APPROVED" || r.status === "IN_USE",
    ) ?? [];
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const currentlyInUse = allApproved.filter((r) => {
    if (!r.startDate || !r.endDate) return false;
    const s = new Date(r.startDate);
    const e = new Date(r.endDate);
    const startISO = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
    const endISO = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
    return r.status === "IN_USE" && todayISO >= startISO && todayISO <= endISO;
  });
  const reservedToday = allApproved.filter((r) => {
    if (!r.startDate || !r.endDate) return false;
    const s = new Date(r.startDate);
    const e = new Date(r.endDate);
    const startISO = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
    const endISO = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
    return r.status === "APPROVED" && todayISO >= startISO && todayISO <= endISO;
  });
  const upcoming = allApproved.filter((r) => {
    if (!r.startDate || !r.endDate) return true;
    const s = new Date(r.startDate);
    const startISO = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
    return todayISO < startISO;
  });
  const rejected =
    machine.requests?.filter((r) => r.status === "REJECTED") ?? [];
  const history =
    machine.requests
      ?.filter((r) => r.status === "RETURNED" || r.status === "OVERDUE")
      .sort((a, b) => {
        const dateA = a.returnedAt ?? a.endDate ?? a.requestDate;
        const dateB = b.returnedAt ?? b.endDate ?? b.requestDate;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }) ?? [];
  const sortedPending = [...pending].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  const expired = allApproved.filter((r) => {
    if (!r.endDate) return false;
    const e = new Date(r.endDate);
    const endISO = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
    return todayISO > endISO;
  });
  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header image */}
        <div className="relative h-56 bg-gray-100 shrink-0">
          {machine.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={machine.imageUrl}
              alt={machine.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tractor size={48} className="text-blue-300" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <h3 className="text-xl font-bold text-[#173a2b]">{machine.name}</h3>
            <p className="mt-1 text-sm text-[#718176]">
              {machine.description || "No description provided"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                machine.isBorrowed
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {machine.isBorrowed ? "Currently In Use" : "Available"}
            </span>
          </div>

          {(() => {
            return (
              <>
                {sortedPending.length > 0 && (
                  <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] p-4">
                    <button
                      onClick={() => setQueueExpanded(!queueExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Queue ({sortedPending.length})
                      </p>
                      {queueExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </button>
                    <div className="mt-3 space-y-2.5">
                      {(queueExpanded ? sortedPending : sortedPending.slice(0, 3)).map((req) => (
                        <button
                          key={req.id}
                          onClick={() => onViewRequest(req)}
                          className="w-full flex items-center justify-between rounded-lg bg-white border border-[#eef2e8] px-3 py-2.5 text-left transition hover:border-green-300 hover:bg-green-50/30 active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 ml-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg">
                            Check Request
                          </span>
                        </button>
                      ))}
                    </div>
                    {!queueExpanded && sortedPending.length > 3 && (
                      <button
                        onClick={() => setQueueExpanded(true)}
                        className="mt-2 text-xs text-green-600 font-semibold hover:underline"
                      >
                        Show all {sortedPending.length}
                      </button>
                    )}
                  </div>
                )}

                {returnPending.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">
                      Return Requests ({returnPending.length})
                    </p>
                    <div className="space-y-2.5">
                      {returnPending.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5 ml-2">
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  requestId: req.id,
                                  action: "return",
                                  title: "Confirm Return",
                                  message: `Confirm that ${req.member.name} has returned the machine?`,
                                  confirmLabel: "Yes, Confirm Return",
                                })
                              }
                              className="rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white"
                            >
                              Confirm Return
                            </button>
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  requestId: req.id,
                                  action: "rejectReturn",
                                  title: "Reject Return",
                                  message: `Reject ${req.member.name}'s return request? They will be asked to continue using the machine until the scheduled end date.`,
                                  confirmLabel: "Yes, Reject",
                                })
                              }
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-600"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentlyInUse.length > 0 && (
                  <div className="rounded-xl bg-[#fff7ed] border border-[#fed7aa] p-4">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-3">
                      Currently In Use ({currentlyInUse.length})
                    </p>
                    <div className="space-y-2.5">
                      {currentlyInUse.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-orange-100 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 ml-2 flex gap-1.5">
                            <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">
                              In Use
                            </span>
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  requestId: req.id,
                                  action: "return",
                                  title: "Mark as Returned",
                                  message: "Are you sure you want to mark this request as returned?",
                                  confirmLabel: "Yes, Mark Returned",
                                })
                              }
                              className="rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white"
                            >
                              Returned
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reservedToday.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
                      Reserved — Not Yet Confirmed ({reservedToday.length})
                    </p>
                    <div className="space-y-2.5">
                      {reservedToday.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-amber-100 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 gap-1.5">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                              Reserved
                            </span>
                            <button
                              onClick={() => onLifecycle(req.id, "start")}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white"
                            >
                              Start use
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {upcoming.length > 0 && (
                  <div className="rounded-xl bg-[#f0f7ff] border border-[#dbeafe] p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Upcoming ({upcoming.length})
                    </p>
                    <div className="space-y-2.5">
                      {upcoming.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-[#eef2e8] px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-1.5">
                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                              {req.status === "APPROVED" ? "Reserved" : req.status.replace("_", " ")}
                            </span>
                            {req.status === "APPROVED" && (
                              <button
                                onClick={() => onLifecycle(req.id, "start")}
                                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white"
                              >
                                Start use
                              </button>
                            )}
                            {req.status === "IN_USE" && (
                              <>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      requestId: req.id,
                                      action: "return",
                                      title: "Mark as Returned",
                                      message:
                                        "Are you sure you want to mark this request as returned?",
                                      confirmLabel: "Yes, Mark Returned",
                                    })
                                  }
                                  className="rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white"
                                >
                                  Returned
                                </button>
                                {req.endDate && todayISO > (() => {
                                  const e = new Date(req.endDate);
                                  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
                                })() && (
                                  <button
                                    onClick={() =>
                                      setConfirmAction({
                                        requestId: req.id,
                                        action: "overdue",
                                        title: "Remind Overdue",
                                        message:
                                          "Are you sure you want to notify the borrower that this request is overdue?",
                                        confirmLabel: "Yes, Send Reminder",
                                      })
                                    }
                                    className="rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-600"
                                  >
                                    Remind overdue
                                  </button>
                                )}
                              </>
                            )}
                            {req.status === "OVERDUE" && (
                              <>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      requestId: req.id,
                                      action: "return",
                                      title: "Mark as Returned",
                                      message:
                                        "Are you sure you want to mark this request as returned?",
                                      confirmLabel: "Yes, Mark Returned",
                                    })
                                  }
                                  className="rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white"
                                >
                                  Returned
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      requestId: req.id,
                                      action: "remind",
                                      title: "Resend Overdue Reminder",
                                      message:
                                        "Are you sure you want to resend an overdue reminder to the borrower?",
                                      confirmLabel: "Yes, Send Reminder",
                                    })
                                  }
                                  className="rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-600"
                                >
                                  Remind
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rejected.length > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                    <button
                      onClick={() => setRejectedExpanded(!rejectedExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                        Rejected ({rejected.length})
                      </p>
                      {rejectedExpanded ? (
                        <ChevronUp size={16} className="text-red-400" />
                      ) : (
                        <ChevronDown size={16} className="text-red-400" />
                      )}
                    </button>
                    {rejectedExpanded && (
                      <div className="mt-3 space-y-2.5">
                        {rejected.map((req) => (
                          <button
                            key={req.id}
                            onClick={() => onViewRejected(req)}
                            className="w-full flex items-center justify-between rounded-lg bg-white border border-red-100 px-3 py-2.5 text-left transition hover:border-red-300 hover:bg-red-50/50 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-[11px] font-bold text-red-700 shrink-0">
                                {req.member.name.charAt(0)}
                              </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                            </div>
                            <span className="shrink-0 ml-2 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg">
                              View
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {expired.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <button
                      onClick={() => setExpiredExpanded(!expiredExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                        Needs Attention ({expired.length})
                      </p>
                      {expiredExpanded ? (
                        <ChevronUp size={16} className="text-amber-400" />
                      ) : (
                        <ChevronDown size={16} className="text-amber-400" />
                      )}
                    </button>
                    <div className="mt-3 space-y-2.5">
                      {(expiredExpanded ? expired : expired.slice(0, 3)).map((req) => (
                        <button
                          key={req.id}
                          onClick={() => onViewRequest(req)}
                          className="w-full flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50/50 active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 ml-2 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">
                            Check Request
                          </span>
                        </button>
                      ))}
                    </div>
                    {!expiredExpanded && expired.length > 3 && (
                      <button
                        onClick={() => setExpiredExpanded(true)}
                        className="mt-2 text-xs text-amber-600 font-semibold hover:underline"
                      >
                        Show all {expired.length}
                      </button>
                    )}
                  </div>
                )}

                {history.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Borrowing History ({history.length})
                      </p>
                      {historyExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </button>
                    <div className="mt-3 space-y-2.5">
                      {(historyExpanded ? history : history.slice(0, 3)).map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-600 shrink-0">
                              {req.member.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#173a2b] block truncate">
                                {req.member.name}
                              </span>
                              {req.startedAt && req.returnedAt ? (
                                <p className="text-xs text-[#718176]">
                                  Used{" "}
                                  {new Date(req.startedAt).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.returnedAt).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : req.returnedAt && req.startDate ? (
                                <p className="text-xs text-[#718176]">
                                  Used{" "}
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.returnedAt).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : req.startDate && req.endDate ? (
                                <p className="text-xs text-[#718176]">
                                  {new Date(req.startDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                  {" – "}
                                  {new Date(req.endDate).toLocaleDateString(
                                    "en-PH",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  No dates set
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 ml-2 px-2.5 py-1 text-[10px] font-bold rounded-full ${
                              req.status === "RETURNED"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {req.status === "RETURNED" ? "Returned" : "Overdue"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!historyExpanded && history.length > 3 && (
                      <button
                        onClick={() => setHistoryExpanded(true)}
                        className="mt-2 text-xs text-green-600 font-semibold hover:underline"
                      >
                        Show all {history.length}
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={() => onEdit(machine)}
            className="flex-1 py-3 bg-[#174b36] hover:bg-[#1a5c42] text-white rounded-2xl font-bold transition flex items-center justify-center gap-2"
          >
            <Pencil size={16} />
            Edit
          </button>
          <button
            onClick={() => onDelete(machine)}
            className="py-3 px-5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>

    {confirmAction && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {confirmAction.title}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmAction.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={machineActionBusy}
                className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setMachineActionBusy(true);
                  try {
                    await onLifecycle(confirmAction.requestId, confirmAction.action);
                  } finally {
                    setMachineActionBusy(false);
                    setConfirmAction(null);
                  }
                }}
                disabled={machineActionBusy}
                className={`flex-1 py-3 text-white rounded-2xl font-bold transition disabled:opacity-50 ${
                  confirmAction.action === "return"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {machineActionBusy ? "Processing..." : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function RequestDetailModal({
  request,
  onClose,
  onDecide,
}: {
  request: MachineRequestInfo;
  onClose: () => void;
  onDecide: (
    requestId: string,
    action: MachineRequestAction,
    message?: string,
  ) => void;
}) {
  const [step, setStep] = useState<
    "idle" | "confirm-approve" | "reject-message"
  >("idle");
  const [rejectionMessage, setRejectionMessage] = useState("");
  const member = request.member;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#174b36] to-[#246b4a] p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full transition"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {member.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold">{member.name}</h3>
              <p className="text-sm text-white/70">Borrow Request</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Calendar size={14} />
            {request.startDate && request.endDate ? (
              <span>
                {new Date(request.startDate).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {" – "}
                {new Date(request.endDate).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="italic">No dates set</span>
            )}
          </div>
        </div>

        {/* Member Info */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Member Information
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-[#173a2b]">
                <Users size={14} className="text-gray-400 shrink-0" />
                <span className="font-medium">{member.email}</span>
              </div>
              {member.contact && (
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <span>{member.contact}</span>
                </div>
              )}
              {member.address && (
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span>{member.address}</span>
                </div>
              )}
            </div>
          </div>

          {member.farmSize && (
            <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Farm Details
              </p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <Wheat size={14} className="text-gray-400 shrink-0" />
                  <span>
                    {member.farmSize} hectares — {member.cropType}
                  </span>
                </div>
                {member.yearsFarming != null && (
                  <div className="flex items-center gap-2.5 text-[#173a2b]">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <span>
                      {member.yearsFarming} year
                      {member.yearsFarming !== 1 ? "s" : ""} of farming
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {request.status === "QUEUED" && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-3">
            {step === "confirm-approve" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                <p className="text-sm font-semibold text-amber-800 mb-3">
                  Are you sure you want to approve this request?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("idle")}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onDecide(request.id, "approve");
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-sm text-white transition"
                  >
                    Yes, Approve
                  </button>
                </div>
              </div>
            )}

            {step === "reject-message" && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-800">
                  Rejection Message
                </p>
                <textarea
                  value={rejectionMessage}
                  onChange={(e) => setRejectionMessage(e.target.value)}
                  placeholder="Enter the reason for rejection. This will be sent to the member."
                  rows={3}
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep("idle");
                      setRejectionMessage("");
                    }}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl font-bold text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!rejectionMessage.trim()) return;
                      onDecide(request.id, "reject", rejectionMessage.trim());
                      onClose();
                    }}
                    disabled={!rejectionMessage.trim()}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-sm text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}

            {step === "idle" && (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("reject-message")}
                  className="flex-1 py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition flex items-center justify-center gap-2"
                >
                  <X size={16} />
                  Reject
                </button>
                <button
                  onClick={() => setStep("confirm-approve")}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
              </div>
            )}
          </div>
        )}

        {(request.status === "APPROVED" || request.status === "IN_USE" || request.status === "OVERDUE" || request.status === "RETURN_PENDING") && (
          <div className="p-6 border-t border-gray-100 bg-gray-50">
            {request.status === "APPROVED" && (
              <button
                onClick={() => {
                  onDecide(request.id, "start");
                  onClose();
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2"
              >
                Start use
              </button>
            )}
            {request.status === "IN_USE" && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onDecide(request.id, "return");
                    onClose();
                  }}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition"
                >
                  Returned
                </button>
                {request.endDate && (() => {
                  const e = new Date(request.endDate);
                  const endISO = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
                  const nowISO = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
                  return nowISO > endISO ? (
                    <button
                      onClick={() => {
                        onDecide(request.id, "overdue");
                        onClose();
                      }}
                      className="flex-1 py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition"
                    >
                      Remind overdue
                    </button>
                  ) : null;
                })()}
              </div>
            )}
            {request.status === "RETURN_PENDING" && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onDecide(request.id, "return");
                    onClose();
                  }}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition"
                >
                  Confirm Return
                </button>
                <button
                  onClick={() => {
                    onDecide(request.id, "rejectReturn");
                    onClose();
                  }}
                  className="flex-1 py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition"
                >
                  Reject
                </button>
              </div>
            )}
            {request.status === "OVERDUE" && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onDecide(request.id, "return");
                    onClose();
                  }}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition"
                >
                  Returned
                </button>
                <button
                  onClick={() => {
                    onDecide(request.id, "remind");
                    onClose();
                  }}
                  className="flex-1 py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition"
                >
                  Remind
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RejectionDetailModal({
  request,
  onClose,
}: {
  request: MachineRequestInfo;
  onClose: () => void;
}) {
  const member = request.member;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-red-500 to-red-700 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full transition"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {member.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold">{member.name}</h3>
              <p className="text-sm text-white/70">Rejected Request</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Calendar size={14} />
            {request.startDate && request.endDate ? (
              <span>
                {new Date(request.startDate).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {" – "}
                {new Date(request.endDate).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : (
              <span className="italic">No dates set</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Member Information
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-[#173a2b]">
                <Users size={14} className="text-gray-400 shrink-0" />
                <span className="font-medium">{member.email}</span>
              </div>
              {member.contact && (
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <span>{member.contact}</span>
                </div>
              )}
              {member.address && (
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span>{member.address}</span>
                </div>
              )}
            </div>
          </div>

          {member.farmSize && (
            <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Farm Details
              </p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-[#173a2b]">
                  <Wheat size={14} className="text-gray-400 shrink-0" />
                  <span>
                    {member.farmSize} hectares — {member.cropType}
                  </span>
                </div>
                {member.yearsFarming != null && (
                  <div className="flex items-center gap-2.5 text-[#173a2b]">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <span>
                      {member.yearsFarming} year
                      {member.yearsFarming !== 1 ? "s" : ""} of farming
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {request.rejectionReason && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                Rejection Reason
              </p>
              <p className="text-sm text-red-800 leading-relaxed">
                {request.rejectionReason}
              </p>
            </div>
          )}
        </div>

        {/* Close */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MachineFormModal({
  machine,
  onClose,
  onSave,
}: {
  machine: Machine | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(machine?.name || "");
  const [description, setDescription] = useState(machine?.description || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    machine?.imageUrl || null,
  );
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!machine;

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Machine name is required");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      if (imageFile) formData.append("image", imageFile);
      if (removeImage) formData.append("removeImage", "true");

      const url = isEditing ? `/api/machines/${machine.id}` : "/api/machines";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      onSave();
      onClose();
    } catch {
      setError("Failed to save machine");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isEditing ? "Edit Machine" : "Add Machine"}
            </h3>
            <p className="text-xs text-blue-700 font-medium uppercase tracking-wider">
              {isEditing
                ? "Update machine information"
                : "Register new equipment"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Image (optional)
            </label>
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition"
              >
                <ImagePlus size={28} />
                <span className="text-xs font-medium">
                  Click to upload image
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Machine Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rice Harvester"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the machine..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
            />
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            type="button"
            className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-2xl font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 bg-[#174b36] hover:bg-[#1a5c42] text-white rounded-2xl font-bold transition disabled:opacity-50 disabled:cursor-wait"
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Update Machine"
                : "Add Machine"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationDetailModal({
  application,
  onClose,
  onAction,
}: {
  application: Application;
  onClose: () => void;
  onAction: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isPending = application.status === "PENDING";

  async function handleConfirm(action: "approve" | "reject") {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/secretary/applications/${application.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "reject" ? { reason: rejectionReason.trim() } : {},
          ),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setConfirmAction(null);
        onAction();
        onClose();
      } else {
        setError(data.error || `Failed to ${action} application`);
      }
    } catch {
      setError(`Failed to ${action} application`);
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {application.fullName}
            </h3>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Membership Application
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${APP_STATUS_STYLE[application.status] || ""}`}
            >
              {application.status}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Personal Info */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Personal Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Full Name" value={application.fullName} />
              <DetailField label="Age" value={String(application.age ?? "")} />
              <DetailField label="Gender" value={application.gender} />
              <DetailField label="Contact" value={application.contact} />
              <div className="col-span-2">
                <DetailField label="Address" value={application.address} />
              </div>
            </div>
          </div>

          {/* Farming Info */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Farming Information
            </p>
            <div className="grid grid-cols-3 gap-3">
              <DetailField
                label="Farm Size"
                value={`${application.farmSize} ha`}
              />
              <DetailField label="Crop Type" value={application.cropType} />
              <DetailField
                label="Years Farming"
                value={`${application.yearsFarming} years`}
              />
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Documents
            </p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={application.validIdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 hover:border-green-300 hover:bg-green-50/30 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    Valid ID
                  </p>
                  <p className="text-[11px] text-[#718176]">Click to view</p>
                </div>
              </a>
              <a
                href={application.proofOfFarmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 hover:border-green-300 hover:bg-green-50/30 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    Proof of Farm
                  </p>
                  <p className="text-[11px] text-[#718176]">Click to view</p>
                </div>
              </a>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            Applied on{" "}
            {new Date(application.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            {confirmAction ? (
              <div className="flex-1 space-y-3">
                {confirmAction === "reject" && (
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Reason for rejection"
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setConfirmAction(null);
                      setRejectionReason("");
                    }}
                    disabled={acting}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleConfirm(confirmAction)}
                    disabled={
                      acting ||
                      (confirmAction === "reject" && !rejectionReason.trim())
                    }
                    className={`flex-1 py-3 text-white rounded-2xl font-bold transition disabled:opacity-50 ${
                      confirmAction === "approve"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {acting
                      ? "Processing..."
                      : confirmAction === "approve"
                        ? "Confirm Approve"
                        : "Confirm Reject"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setConfirmAction("reject")}
                  className="flex-1 py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl font-bold transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => setConfirmAction("approve")}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition"
                >
                  Approve
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-3 py-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-semibold text-[#173a2b] mt-0.5">{value}</p>
    </div>
  );
}

function ApplicationsSection({
  items,
  expanded,
  onToggle,
  onClickApp,
}: {
  items: Application[];
  expanded: boolean;
  onToggle: () => void;
  onClickApp: (app: Application) => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard
      section="applications"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
    >
      {visible.length > 0 ? (
        visible.map((app) => (
          <button
            key={app.id}
            onClick={() => onClickApp(app)}
            className="w-full flex items-center justify-between rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#173a2b] truncate">
                {app.fullName}
              </p>
              <p className="text-xs text-[#718176]">
                {app.cropType} · Applied{" "}
                {new Date(app.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${APP_STATUS_STYLE[app.status] || ""}`}
            >
              {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
            </span>
          </button>
        ))
      ) : (
        <EmptyState text="No applications found" />
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
    <SectionCard
      section="members"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
    >
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
    <SectionCard
      section="loans"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
    >
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
  onAdd,
  onClickMachine,
}: {
  items: Machine[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onClickMachine: (m: Machine) => void;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard
      section="machines"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
      headerAction={
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="rounded-lg bg-blue-500 p-1.5 text-white hover:bg-blue-600 transition"
        >
          <Plus size={14} />
        </button>
      }
    >
      {visible.length > 0 ? (
        visible.map((machine) => (
          <button
            key={machine.id}
            onClick={() => onClickMachine(machine)}
            className="w-full flex items-center gap-3 rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.99]"
          >
            {machine.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={machine.imageUrl}
                alt={machine.name}
                className="h-11 w-11 rounded-lg object-cover shrink-0 border border-gray-200"
              />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Tractor size={18} className="text-blue-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#173a2b] truncate">
                {machine.name}
              </p>
              {machine.currentUsage && machine.currentUsage.length > 0 ? (
                machine.currentUsage.map((u, i) => (
                  <p key={i} className="text-[11px] text-[#718176] truncate">
                    In use by {u.name}
                    {u.startDate && u.endDate && (
                      <>
                        {" "}
                        ·{" "}
                        {new Date(u.startDate).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {new Date(u.endDate).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </>
                    )}
                  </p>
                ))
              ) : (
                <p className="text-[11px] text-[#718176] truncate">Available</p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                machine.isBorrowed
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {machine.isBorrowed ? "In Use" : "Available"}
            </span>
          </button>
        ))
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
    <SectionCard
      section="supplies"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
    >
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
              {supply.stock === 0 ? "Out of stock" : `${supply.stock} in stock`}
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

  const [detailMachine, setDetailMachine] = useState<Machine | null>(null);
  const [formMachine, setFormMachine] = useState<Machine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [viewRequest, setViewRequest] = useState<MachineRequestInfo | null>(
    null,
  );
  const [viewRejectedRequest, setViewRejectedRequest] =
    useState<MachineRequestInfo | null>(null);

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

  useEffect(() => {
    fetchData();
  }, []);

  function toggleSection(section: Section) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function handleClickMachine(machine: Machine) {
    setDetailMachine(machine);
  }

  function handleEditFromDetail(machine: Machine) {
    setDetailMachine(null);
    setFormMachine(machine);
    setShowForm(true);
  }

  function handleDeleteFromDetail(machine: Machine) {
    setDetailMachine(null);
    setDeleteConfirm(machine);
  }

  async function handleDecideRequest(
    requestId: string,
    action: MachineRequestAction,
    message?: string,
  ) {
    try {
      const res = await fetch(`/api/machines/request/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      const result = await res.json();
      if (res.ok) {
        await fetchData();
        const newStatus = {
          approve: "APPROVED",
          reject: "REJECTED",
          start: "IN_USE",
          return: "RETURNED",
          overdue: "OVERDUE",
          remind: undefined,
          rejectReturn: "IN_USE",
        }[action];
        if (newStatus) {
          setDetailMachine((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              requests: prev.requests.map((r) =>
                r.id === requestId
                  ? {
                      ...r,
                      status: newStatus,
                      rejectionReason:
                        action === "reject"
                          ? (message ?? r.rejectionReason)
                          : r.rejectionReason,
                    }
                  : r,
              ),
            };
          });
          setViewRequest((prev) => {
            if (!prev || prev.id !== requestId) return prev;
            return {
              ...prev,
              status: newStatus,
              rejectionReason:
                action === "reject"
                  ? (message ?? prev.rejectionReason)
                  : prev.rejectionReason,
            };
          });
        }
      } else {
        alert(result.error || `Failed to ${action} request`);
      }
    } catch {
      alert(`Failed to ${action} request`);
    }
  }

  function handleAddMachine() {
    setFormMachine(null);
    setShowForm(true);
  }

  async function handleDeleteMachine() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/machines/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      } else {
        alert(result.error || "Failed to delete machine");
      }
    } catch {
      alert("Failed to delete machine");
    } finally {
      setDeleting(false);
    }
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
      label: "Machines In Use",
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
          onClickApp={(app) => setDetailApp(app)}
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
          onAdd={handleAddMachine}
          onClickMachine={handleClickMachine}
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

      {/* Machine Detail Modal */}
      {detailMachine && (
        <MachineDetailModal
          machine={detailMachine}
          onClose={() => setDetailMachine(null)}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
          onViewRequest={setViewRequest}
          onViewRejected={setViewRejectedRequest}
          onLifecycle={handleDecideRequest}
        />
      )}

      {/* Request Detail Modal */}
      {viewRequest && (
        <RequestDetailModal
          request={viewRequest}
          onClose={() => setViewRequest(null)}
          onDecide={handleDecideRequest}
        />
      )}

      {/* Rejection Detail Modal */}
      {viewRejectedRequest && (
        <RejectionDetailModal
          request={viewRejectedRequest}
          onClose={() => setViewRejectedRequest(null)}
        />
      )}

      {/* Application Detail Modal */}
      {detailApp && (
        <ApplicationDetailModal
          application={detailApp}
          onClose={() => setDetailApp(null)}
          onAction={fetchData}
        />
      )}

      {/* Machine Form Modal */}
      {showForm && (
        <MachineFormModal
          machine={formMachine}
          onClose={() => {
            setShowForm(false);
            setFormMachine(null);
          }}
          onSave={fetchData}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Delete Machine
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-700">
                  {deleteConfirm.name}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMachine}
                  disabled={deleting}
                  className="flex-1 py-3 bg-red-600 text-white hover:bg-red-700 rounded-2xl font-bold transition disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
