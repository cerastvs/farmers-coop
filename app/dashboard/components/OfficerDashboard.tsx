"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { IconLeaf, IconLoan, IconMachine } from "@/components/icons";
import { ImageModal } from "@/components/ImageModal";
import { ReportModal, ReportContent } from "@/components/ReportModal";
import { logout } from "../../login/actions";
import AdminActionsPanel from "../secretary/AdminActionsPanel";
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
  CheckCircle2,
  Phone,
  MapPin,
  Wheat,
  Calendar,
  BarChart3,
  Megaphone,
  ClipboardCheck,
  Bell,
  Search,
  Clock,
  LogOut,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  TrendingUp,
  HandHelping,
  MessageSquare,
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
  farmOwnership: string | null;
  farmMachinery: string | null;
  guarantor: { name?: string; contact?: string; relationship?: string } | null;
  validIdUrl: string;
  proofOfFarmUrl: string;
  status: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
  joined: string;
  farm: string | null;
}

interface Loan {
  id: string;
  borrower: { name: string; username: string };
  name: string;
  type: string;
  amount: number;
  remainingBalance: number;
  termMonths: number;
  purpose: string | null;
  status: string;
  rejectionReason: string | null;
  due: string | null;
  createdAt: string;
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
  loanLimitPerHectare: number | null;
  transactions: SupplyRequest[];
}

interface SupplyRequest {
  id: string;
  quantity: number;
  totalPrice: number;
  type: string;
  status: string;
  rejectionReason: string | null;
  user: { name: string; username: string };
}

interface PaymentSubmission {
  id: string;
  user: { name: string; username: string };
  loan: { name: string } | null;
  amount: number;
  receiptUrl: string | null;
  referenceNo: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface ReportRecord {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown> | null;
}

interface PostRecord {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
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
  payments: PaymentSubmission[];
  reports: ReportRecord[];
  posts: PostRecord[];
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
  "payments",
  "machines",
  "supplies",
  "reports",
  "announcements",
  "sms",
  "overdue",
] as const;
type Section = (typeof SECTIONS)[number];
type MachineRequestAction =
  | "approve"
  | "reject"
  | "start"
  | "return"
  | "overdue"
  | "remind"
  | "rejectReturn"
  | "ping";

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
  payments: {
    label: "Payments",
    icon: ClipboardCheck,
    accent: "border-l-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-600",
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
  reports: {
    label: "Reports",
    icon: BarChart3,
    accent: "border-l-indigo-400",
    iconBg: "bg-indigo-100 text-indigo-600",
  },
  announcements: {
    label: "Announcements",
    icon: Megaphone,
    accent: "border-l-pink-400",
    iconBg: "bg-pink-100 text-pink-600",
  },
  sms: {
    label: "SMS / Notifications",
    icon: MessageSquare,
    accent: "border-l-cyan-400",
    iconBg: "bg-cyan-100 text-cyan-600",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    accent: "border-l-red-400",
    iconBg: "bg-red-100 text-red-600",
  },
};

const VISIBLE_COUNT = 3;

const PENDING_MACHINE_STATUSES = ["QUEUED", "RETURN_PENDING", "OVERDUE"] as const;

function hasPendingMachineAction(m: Machine) {
  return m.requests.some((r) =>
    (PENDING_MACHINE_STATUSES as readonly string[]).includes(r.status),
  );
}

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

function PendingOnlyToggle({
  active,
  count,
  onToggle,
}: {
  active: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-[0.98] ${
        active
          ? "bg-red-50 text-red-600 ring-1 ring-red-200"
          : "bg-white text-[#5a7267] ring-1 ring-[#e2ebe6] hover:bg-[#f0f7eb]"
      }`}
      title={active ? "Show all items" : "Show only items awaiting action"}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-red-500" : "bg-[#c4d2c6]"}`}
      />
      {active ? "Showing pending" : "Pending only"}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 py-px ${
            active ? "bg-red-500 text-white" : "bg-[#eef2e8] text-[#718176]"
          }`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
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
                    <p className="mt-1.5 text-xs text-amber-600/80">
                      These bookings have passed their scheduled end date but haven&apos;t been marked as returned.
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {(expiredExpanded ? expired : expired.slice(0, 3)).map((req) => (
                        <button
                          key={req.id}
                          onClick={() =>
                            setConfirmAction({
                              requestId: req.id,
                              action: "ping",
                              title: `${req.member.name} — not yet returned`,
                              message: `This booking ended on ${new Date(req.endDate!).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })} but hasn't been marked as returned. What would you like to do?`,
                              confirmLabel: "Remind to return",
                            })
                          }
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
                            View
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
            {confirmAction.action === "ping" ? (
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
                      await onLifecycle(confirmAction.requestId, "ping");
                    } finally {
                      setMachineActionBusy(false);
                      setConfirmAction(null);
                    }
                  }}
                  disabled={machineActionBusy}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold transition disabled:opacity-50"
                >
                  {machineActionBusy ? "Processing..." : "Remind to return"}
                </button>
                <button
                  onClick={async () => {
                    setMachineActionBusy(true);
                    try {
                      await onLifecycle(confirmAction.requestId, "return");
                    } finally {
                      setMachineActionBusy(false);
                      setConfirmAction(null);
                    }
                  }}
                  disabled={machineActionBusy}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition disabled:opacity-50"
                >
                  {machineActionBusy ? "Processing..." : "Mark as returned"}
                </button>
              </div>
            ) : (
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
            )}
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
  const [formImageModal, setFormImageModal] = useState<string | null>(null);

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
                <button
                  type="button"
                  onClick={() => setFormImageModal(imagePreview)}
                  className="block w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover hover:opacity-90 transition"
                  />
                </button>
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

      {formImageModal && (
        <ImageModal
          src={formImageModal}
          alt="Preview"
          onClose={() => setFormImageModal(null)}
        />
      )}
    </div>
  );
}

function ApplicationDetailModal({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);

  const isPending = application.status === "PENDING";

  return (
    <>
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
              <DetailField
                label="Farm Ownership"
                value={
                  application.farmOwnership === "FARM_OWNER"
                    ? "Farm owner"
                    : application.farmOwnership === "FARM_WORKER"
                      ? "Farm worker / tenant"
                      : application.farmOwnership === "OTHERS"
                        ? "Others"
                        : application.farmOwnership || "—"
                }
              />
              <DetailField
                label="Farm Machinery"
                value={application.farmMachinery || "None"}
              />
            </div>
          </div>

          {/* Guarantor */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Guarantor
            </p>
            {application.guarantor ? (
              <div className="grid grid-cols-3 gap-3">
                <DetailField
                  label="Name"
                  value={application.guarantor.name || "—"}
                />
                <DetailField
                  label="Contact"
                  value={application.guarantor.contact || "—"}
                />
                <DetailField
                  label="Relationship"
                  value={application.guarantor.relationship || "—"}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 text-sm text-[#718176]">
                No guarantor provided
              </div>
            )}
          </div>

          {/* Documents */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Documents
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImageModal({ src: application.validIdUrl, alt: "Valid ID" })}
                className="group flex items-center gap-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 hover:border-green-300 hover:bg-green-50/30 transition text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={application.validIdUrl}
                  alt="Valid ID"
                  className="h-16 w-16 rounded-lg object-cover transition group-hover:opacity-80"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    Valid ID
                  </p>
                  <p className="text-[11px] text-[#718176]">Click to enlarge</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setImageModal({ src: application.proofOfFarmUrl, alt: "Proof of Farm" })}
                className="group flex items-center gap-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 hover:border-green-300 hover:bg-green-50/30 transition text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={application.proofOfFarmUrl}
                  alt="Proof of Farm"
                  className="h-16 w-16 rounded-lg object-cover transition group-hover:opacity-80"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    Proof of Farm
                  </p>
                  <p className="text-[11px] text-[#718176]">Click to enlarge</p>
                </div>
              </button>
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
          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">
              Membership application decisions are made by the{" "}
              <span className="font-bold text-[#173a2b]">President</span> in
              the Membership Applications section of the admin workspace.
            </p>
          </div>
        )}
      </div>
    </div>

    {imageModal && (
      <ImageModal
        src={imageModal.src}
        alt={imageModal.alt}
        onClose={() => setImageModal(null)}
      />
    )}
    </>
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
  onEdit,
  busy,
}: {
  items: Member[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (id: string, data: { name: string; role: string; active: boolean }) => void;
  busy: string | null;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditRole(m.role);
    setEditActive(m.active);
  }

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
              className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
            >
              {editingId === m.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#39733e]"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                    >
                      {["MEMBER", "SECRETARY", "TREASURER", "PRESIDENT"].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <select
                      value={String(editActive)}
                      onChange={(e) => setEditActive(e.target.value === "true")}
                      className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy === m.id}
                      onClick={() => {
                        onEdit(m.id, { name: editName, role: editRole, active: editActive });
                        setEditingId(null);
                      }}
                      className="rounded-lg bg-green-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          m.role === "PRESIDENT"
                            ? "bg-red-100 text-red-600"
                            : m.role === "TREASURER"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {m.role}
                      </span>
                      {!m.active && (
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(m)}
                    className="shrink-0 rounded-lg border border-[#dce5d9] p-1.5 text-[#718176] hover:bg-[#edf5df] transition"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
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
  onAction,
  busy,
  pendingOnly = false,
}: {
  items: Loan[];
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, action: "approve" | "reject", reason?: string) => void;
  busy: string | null;
  pendingOnly?: boolean;
}) {
  const [loanType, setLoanType] = useState<"SUPPLY" | "MONEY">("MONEY");
  const [loanTab, setLoanTab] = useState<"requests" | "payments" | "overdue">("requests");

  const now = new Date();
  const filtered = items.filter((l) => l.type === loanType);

  const requests = filtered.filter((l) => l.status === "PENDING");
  const payments = filtered.filter((l) => l.status === "APPROVED" || l.status === "ACTIVE");
  const overdue = filtered.filter(
    (l) => l.status === "ACTIVE" && l.due && new Date(l.due) < now,
  );

  const activeLoans = pendingOnly ? requests : loanTab === "requests" ? requests : loanTab === "payments" ? payments : overdue;

  const TAB_STYLE = {
    requests: "bg-yellow-100 text-yellow-700",
    payments: "bg-blue-100 text-blue-700",
    overdue: "bg-red-100 text-red-600",
  } as const;

  return (
    <SectionCard
      section="loans"
      count={filtered.length}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setLoanType("MONEY")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            loanType === "MONEY"
              ? "bg-[#173a2b] text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          Money Loans
        </button>
        <button
          onClick={() => setLoanType("SUPPLY")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            loanType === "SUPPLY"
              ? "bg-[#173a2b] text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          Supply Loans
        </button>
      </div>

      {!pendingOnly && (
        <div className="flex gap-1 mb-2">
          {(["requests", "payments", "overdue"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setLoanTab(tab)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition capitalize ${
                loanTab === tab ? TAB_STYLE[tab] : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              {tab} ({tab === "requests" ? requests.length : tab === "payments" ? payments.length : overdue.length})
            </button>
          ))}
        </div>
      )}

      {activeLoans.length > 0 ? (
        activeLoans.map((loan) => (
          <div
            key={loan.id}
            className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">
                    {loan.borrower.name}
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
                {loan.purpose && (
                  <p className="text-xs text-[#718176] mt-0.5">{loan.purpose}</p>
                )}
                {loan.rejectionReason && (
                  <p className="text-xs text-red-600 mt-0.5">Reason: {loan.rejectionReason}</p>
                )}
              </div>
            </div>
            {loan.status === "PENDING" && (
              <div className="flex gap-2 mt-2">
                <button
                  disabled={busy === loan.id}
                  onClick={() => onAction(loan.id, "approve")}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy === loan.id}
                  onClick={() => {
                    const reason = window.prompt("Enter rejection reason:");
                    if (reason) onAction(loan.id, "reject", reason);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <EmptyState
          text={
            pendingOnly
              ? `No pending ${loanType === "SUPPLY" ? "supply" : "money"} loan requests`
              : `No ${loanType === "SUPPLY" ? "supply" : "money"} ${loanTab}`
          }
        />
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
  onImageClick,
}: {
  items: Machine[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onClickMachine: (m: Machine) => void;
  onImageClick: (src: string, alt: string) => void;
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageClick(machine.imageUrl!, machine.name);
                }}
                className="shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={machine.imageUrl}
                  alt={machine.name}
                  className="h-11 w-11 rounded-lg object-cover border border-gray-200 hover:ring-2 hover:ring-blue-400 transition"
                />
              </button>
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
  onAddSupply,
  onUpdateSupply,
  onActionRequest,
  busy,
}: {
  items: Supply[];
  expanded: boolean;
  onToggle: () => void;
  onAddSupply: (data: { productName: string; price: number; quantity: number; loanLimitPerHectare: number | null }) => void;
  onUpdateSupply: (id: string, data: { productName: string; price: number; quantity: number; loanLimitPerHectare: number | null }) => void;
  onActionRequest: (id: string, action: "approve" | "complete" | "reject", reason?: string) => void;
  busy: string | null;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addLimit, setAddLimit] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editLimit, setEditLimit] = useState("");

  function handleAdd() {
    if (!addName.trim() || !addPrice || !addQty) return;
    onAddSupply({
      productName: addName.trim(),
      price: Number(addPrice),
      quantity: Number(addQty),
      loanLimitPerHectare: addLimit ? Number(addLimit) : null,
    });
    setAddName(""); setAddPrice(""); setAddQty(""); setAddLimit(""); setShowAdd(false);
  }

  function startEdit(s: Supply) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPrice(String(s.price));
    setEditQty(String(s.stock));
    setEditLimit(s.loanLimitPerHectare != null ? String(s.loanLimitPerHectare) : "");
  }

  return (
    <SectionCard
      section="supplies"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
      headerAction={
        <button
          onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
          className="rounded-lg bg-orange-500 p-1.5 text-white hover:bg-orange-600 transition"
        >
          <Plus size={14} />
        </button>
      }
    >
      {showAdd && (
        <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
          <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Product name" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
          <div className="flex gap-2">
            <input value={addPrice} onChange={(e) => setAddPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Price" className="w-1/2 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
            <input value={addQty} onChange={(e) => setAddQty(e.target.value)} type="number" min="0" placeholder="Stock" className="w-1/2 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
          </div>
          <input value={addLimit} onChange={(e) => setAddLimit(e.target.value)} type="number" min="0" placeholder="Loan limit per hectare (optional)" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="rounded-lg bg-orange-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-orange-700">Add</button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500">Cancel</button>
          </div>
        </div>
      )}
      {visible.length > 0 ? (
        visible.map((supply) => (
          <div key={supply.id} className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3">
            {editingId === supply.id ? (
              <div className="space-y-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
                <div className="flex gap-2">
                  <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" min="0" step="0.01" className="w-1/2 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
                  <input value={editQty} onChange={(e) => setEditQty(e.target.value)} type="number" min="0" className="w-1/2 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
                </div>
                <input value={editLimit} onChange={(e) => setEditLimit(e.target.value)} type="number" min="0" placeholder="Loan limit per hectare (optional)" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
                <div className="flex gap-2">
                  <button disabled={busy === supply.id} onClick={() => { onUpdateSupply(supply.id, { productName: editName, price: Number(editPrice), quantity: Number(editQty), loanLimitPerHectare: editLimit ? Number(editLimit) : null }); setEditingId(null); }} className="rounded-lg bg-orange-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50">Save</button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#173a2b] truncate">{supply.name}</p>
                    <p className="text-xs text-[#718176]">₱{supply.price.toLocaleString()} per unit</p>
                    {supply.loanLimitPerHectare != null && (
                      <p className="text-[11px] text-orange-600 font-medium mt-0.5">Loan limit: {supply.loanLimitPerHectare} per ha</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${supply.stock === 0 ? "bg-red-100 text-red-600" : supply.stock <= 30 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                      {supply.stock === 0 ? "Out of stock" : `${supply.stock} in stock`}
                    </span>
                    <button onClick={() => startEdit(supply)} className="shrink-0 rounded-lg border border-[#dce5d9] p-1.5 text-[#718176] hover:bg-[#edf5df] transition"><Pencil size={12} /></button>
                  </div>
                </div>
                {supply.transactions.filter((t) => ["PENDING", "APPROVED"].includes(t.status)).length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {supply.transactions.filter((t) => ["PENDING", "APPROVED"].includes(t.status)).map((t) => (
                      <div key={t.id} className="rounded-lg bg-white border border-[#eef2e8] px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span><b>{t.user.name}</b> requests {t.quantity} · {t.type}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          {t.status === "PENDING" && (
                            <>
                              <button disabled={busy === t.id} onClick={() => onActionRequest(t.id, "approve")} className="rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-50">Approve</button>
                              <button disabled={busy === t.id} onClick={() => { const r = window.prompt("Rejection reason:"); if (r) onActionRequest(t.id, "reject", r); }} className="rounded-md border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600 disabled:opacity-50">Reject</button>
                            </>
                          )}
                          {t.status === "APPROVED" && (
                            <button disabled={busy === t.id} onClick={() => onActionRequest(t.id, "complete")} className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-50">Complete</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))
      ) : (
        <EmptyState text="No supplies found" />
      )}
    </SectionCard>
  );
}

function getSecureProofUrl(receiptUrl: string | null) {
  if (!receiptUrl) return null;
  try {
    const url = new URL(receiptUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function PaymentsSection({
  items,
  expanded,
  onToggle,
  onAction,
  onImageClick,
  busy,
}: {
  items: PaymentSubmission[];
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, action: "verify" | "reject", reason?: string) => void;
  onImageClick: (src: string, alt: string) => void;
  busy: string | null;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <SectionCard
      section="payments"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
    >
      {visible.length > 0 ? (
        visible.map((payment) => {
          const proofUrl = getSecureProofUrl(payment.receiptUrl);
          const legacyReference = payment.referenceNo?.trim();
          const hasEvidence = Boolean(proofUrl || legacyReference);
          return (
            <div key={payment.id} className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">{payment.user.name}</p>
                  <p className="text-xs text-[#718176]">₱{payment.amount.toLocaleString()} · {payment.loan?.name ?? "Loan payment"} · {new Date(payment.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${payment.status === "VERIFIED" ? "bg-green-100 text-green-700" : payment.status === "REJECTED" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>{payment.status}</span>
              </div>
              {proofUrl ? (
                <button onClick={() => onImageClick(proofUrl, "Proof of payment")} className="group mt-2 inline-block overflow-hidden rounded-xl border border-[#dce5d9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofUrl} alt="Proof of payment" className="h-20 w-20 rounded-xl object-cover transition group-hover:opacity-80" />
                </button>
              ) : legacyReference ? (
                <p className="mt-1.5 text-xs text-[#718176]">Ref: {legacyReference}</p>
              ) : (
                <p className="mt-1.5 text-xs font-semibold text-amber-700">Missing payment evidence</p>
              )}
              {payment.rejectionReason && <p className="mt-1 text-xs text-red-600">{payment.rejectionReason}</p>}
              {payment.status === "PENDING" && (
                <div className="flex gap-2 mt-2">
                  <button disabled={busy === payment.id || !hasEvidence} onClick={() => onAction(payment.id, "verify")} className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700 transition disabled:opacity-50">Verify</button>
                  <button disabled={busy === payment.id} onClick={() => { const r = window.prompt("Rejection reason:"); if (r) onAction(payment.id, "reject", r); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50">Reject</button>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <EmptyState text="No payment submissions found" />
      )}
    </SectionCard>
  );
}

function ReportsSection({
  items,
  expanded,
  onToggle,
  onGenerate,
  onPreview,
  busy,
}: {
  items: ReportRecord[];
  expanded: boolean;
  onToggle: () => void;
  onGenerate: (type: string, title?: string, filters?: { from?: string; to?: string; memberId?: string; statuses?: string[] }) => Promise<ReportRecord | null>;
  onPreview: (type: string, filters?: { from?: string; to?: string; memberId?: string; statuses?: string[] }) => Promise<ReportRecord | null>;
  busy: string | null;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const [reportType, setReportType] = useState("SUMMARY");
  const [reportTitle, setReportTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statuses, setStatuses] = useState("");
  const [viewReport, setViewReport] = useState<ReportRecord | null>(null);
  const [liveReport, setLiveReport] = useState<ReportRecord | null>(null);
  const firstMount = useRef(true);

  function buildFilters() {
    const filters: { from?: string; to?: string; statuses?: string[] } = {};
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (statuses.trim()) {
      filters.statuses = statuses
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }
    return filters;
  }

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    const t = setTimeout(() => {
      onPreview(reportType, buildFilters()).then((r) => {
        if (r) setLiveReport(r);
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, from, to, statuses]);

  function generate() {
    onGenerate(reportType, reportTitle.trim() || undefined, buildFilters()).then((r) => {
      if (r) setLiveReport(r);
    });
    setReportTitle(""); setFrom(""); setTo(""); setStatuses("");
  }

  return (
    <>
      <SectionCard
        section="reports"
        count={items.length}
        expanded={expanded}
        onToggle={onToggle}
      >
      <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
        <div className="flex gap-2">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs font-semibold outline-none">
            {["SUMMARY", "MEMBERS", "LOANS", "PAYMENTS", "SUPPLIES", "MACHINES", "AUDIT"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Optional title" className="flex-1 rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" className="rounded-lg border border-[#dce5d9] bg-white px-2 py-1.5 text-xs outline-none" />
          <input value={statuses} onChange={(e) => setStatuses(e.target.value)} placeholder="Status filters, e.g. ACTIVE, OVERDUE" className="flex-1 min-w-[180px] rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-xs outline-none" />
        </div>
        <button disabled={busy === "report"} onClick={generate} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50">Generate Report</button>
      </div>
      {liveReport && liveReport.data && (
        <div className="mb-3 rounded-2xl border border-indigo-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{liveReport.type} Report</p>
              <h3 className="text-sm font-bold text-[#173a2b]">{liveReport.title}</h3>
              {liveReport.createdAt && (
                <p className="text-xs text-[#718176]">Updated {new Date(liveReport.createdAt).toLocaleString("en-PH")}</p>
              )}
            </div>
            <button onClick={() => setLiveReport(null)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-50">Dismiss</button>
          </div>
          <ReportContent type={liveReport.type} data={liveReport.data} />
        </div>
      )}
      {visible.length > 0 ? (
        visible.map((report) => (
          <button
            key={report.id}
            onClick={() => setViewReport(report)}
            className="flex w-full items-center justify-between rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#173a2b] truncate">{report.title}</p>
              <p className="text-xs text-[#718176]">{report.type} · {new Date(report.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="ml-3 shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white">View</span>
          </button>
        ))
      ) : (
        <EmptyState text="No reports generated yet" />
      )}
    </SectionCard>
    {viewReport && (
      <ReportModal report={viewReport} onClose={() => setViewReport(null)} />
    )}
    </>
  );
}

function AnnouncementsSection({
  items,
  expanded,
  onToggle,
  onCreate,
  onTogglePublish,
  onDelete,
  busy,
}: {
  items: PostRecord[];
  expanded: boolean;
  onToggle: () => void;
  onCreate: (title: string, content: string, published: boolean) => void;
  onTogglePublish: (id: string, published: boolean) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishNow, setPublishNow] = useState(false);

  function handleCreate() {
    if (!title.trim()) return;
    onCreate(title.trim(), content.trim(), publishNow);
    setTitle(""); setContent(""); setPublishNow(false); setShowForm(false);
  }

  return (
    <SectionCard
      section="announcements"
      count={items.length}
      expanded={expanded}
      onToggle={onToggle}
      headerAction={
        <button
          onClick={(e) => { e.stopPropagation(); setShowForm(!showForm); }}
          className="rounded-lg bg-pink-500 p-1.5 text-white hover:bg-pink-600 transition"
        >
          <Plus size={14} />
        </button>
      }
    >
      {showForm && (
        <div className="mb-3 rounded-xl border border-pink-200 bg-pink-50 p-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the announcement…" rows={3} className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none resize-y" />
          <label className="flex items-center gap-2 text-xs font-semibold text-[#496558]"><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /> Publish immediately</label>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-pink-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-pink-700">Save</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500">Cancel</button>
          </div>
        </div>
      )}
      {visible.length > 0 ? (
        visible.map((post) => (
          <div key={post.id} className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#173a2b] truncate">{post.title}</p>
                <p className="text-xs text-[#718176] truncate">{post.content || "No content"}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{post.published ? "Published" : "Draft"}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button disabled={busy === post.id} onClick={() => onTogglePublish(post.id, post.published)} className="rounded-lg border border-[#dce5d9] px-3 py-1 text-[11px] font-bold text-[#315646] hover:bg-[#edf5df] disabled:opacity-50">{post.published ? "Unpublish" : "Publish"}</button>
              <button disabled={busy === post.id} onClick={() => { if (window.confirm("Delete this announcement?")) onDelete(post.id); }} className="rounded-lg border border-red-200 px-3 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
            </div>
          </div>
        ))
      ) : (
        <EmptyState text="No announcements found" />
      )}
    </SectionCard>
  );
}

interface SmsMessage {
  id: string;
  recipient: string;
  message: string;
  status: string;
  sentByUser: { name: string; username: string; role: string } | null;
  sentBy: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

function SmsSection({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [contact, setContact] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<SmsMessage[]>([]);
  const [expandedList, setExpandedList] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/secretary/sms");
      if (res.ok) {
        const data = await res.json();
        setLocalMessages(data.messages || []);
      }
    } catch {
      console.error("Failed to fetch SMS messages");
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const pendingCount = localMessages.filter((m) => m.status === "PENDING").length;
  const visible = expandedList ? localMessages : localMessages.slice(0, VISIBLE_COUNT);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim() || !msgBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/secretary/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipient.trim(), message: msgBody.trim(), contact: contact.trim() || undefined }),
      });
      if (res.ok) {
        setRecipient(""); setContact(""); setMsgBody("");
        await fetchMessages();
      }
    } finally { setSending(false); }
  }

  async function handlePatch(id: string, action: "send" | "fail") {
    if (action === "fail") {
      const error = window.prompt("Failure reason (optional):");
      if (error === null) return;
      setBusy(id);
      try {
        const res = await fetch(`/api/secretary/sms/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fail", error: error || undefined }),
        });
        if (res.ok) await fetchMessages();
      } finally { setBusy(null); }
    } else {
      setBusy(id);
      try {
        const res = await fetch(`/api/secretary/sms/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send" }),
        });
        if (res.ok) await fetchMessages();
      } finally { setBusy(null); }
    }
  }

  return (
    <SectionCard
      section="sms"
      count={pendingCount}
      expanded={expanded}
      onToggle={onToggle}
    >
      <form onSubmit={handleSend} className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 space-y-2">
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone number (optional)" className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none" />
        <textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Message body..." rows={2} className="w-full rounded-lg border border-[#dce5d9] bg-white px-3 py-1.5 text-sm outline-none resize-none" />
        <button type="submit" disabled={sending || !recipient.trim() || !msgBody.trim()} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-cyan-700 transition disabled:opacity-50">{sending ? "Sending..." : "Queue SMS"}</button>
      </form>
      {visible.length > 0 ? (
        visible.map((sms) => (
          <div key={sms.id} className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#173a2b] truncate">{sms.recipient}</p>
                <p className="text-xs text-[#718176] line-clamp-2">{sms.message}</p>
                <p className="text-[10px] text-[#718176] mt-0.5">
                  {sms.sentByUser?.name ?? "System"} · {new Date(sms.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${sms.status === "SENT" ? "bg-green-100 text-green-700" : sms.status === "FAILED" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>{sms.status}</span>
            </div>
            {sms.error && <p className="text-[10px] text-red-600 mt-1">Error: {sms.error}</p>}
            {sms.status === "PENDING" && (
              <div className="flex gap-2 mt-2">
                <button disabled={busy === sms.id} onClick={() => handlePatch(sms.id, "send")} className="rounded-lg bg-green-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-green-700 disabled:opacity-50">Mark sent</button>
                <button disabled={busy === sms.id} onClick={() => handlePatch(sms.id, "fail")} className="rounded-lg border border-red-200 px-3 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">Mark failed</button>
              </div>
            )}
          </div>
        ))
      ) : (
        <EmptyState text="No SMS messages yet" />
      )}
      {!expandedList && localMessages.length > VISIBLE_COUNT && (
        <button onClick={() => setExpandedList(true)} className="mt-2 text-xs text-cyan-600 font-semibold hover:underline">Show all {localMessages.length}</button>
      )}
    </SectionCard>
  );
}

interface OverdueItem {
  kind: "loan" | "machine";
  id: string;
  member: string;
  amount?: number;
  remaining?: number;
  dueDate: string;
  daysOverdue: number;
  entity: string;
}

function OverdueSection({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [expandedList, setExpandedList] = useState(false);

  const fetchOverdue = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overdue");
      if (res.ok) {
        const data = await res.json();
        setOverdueItems(data.overdue || []);
      }
    } catch {
      console.error("Failed to fetch overdue items");
    }
  }, []);

  useEffect(() => { fetchOverdue(); }, [fetchOverdue]);

  const visible = expandedList ? overdueItems : overdueItems.slice(0, VISIBLE_COUNT);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoMark: true }),
      });
      if (res.ok) await fetchOverdue();
    } finally { setScanning(false); }
  }

  return (
    <SectionCard
      section="overdue"
      count={overdueItems.length}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="mb-3">
        <button disabled={scanning} onClick={handleScan} className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 transition disabled:opacity-50">{scanning ? "Scanning..." : "Run overdue scan"}</button>
      </div>
      {visible.length > 0 ? (
        visible.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="rounded-xl bg-[#fafdf7] border border-[#eef2e8] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#173a2b] truncate">{item.member}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.kind === "loan" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{item.kind === "loan" ? "Loan" : "Machine"}</span>
                </div>
                <p className="text-xs text-[#718176]">{item.entity}</p>
                <p className="text-[10px] text-[#718176]">
                  Due {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {item.remaining != null && ` · ₱${item.remaining.toLocaleString()} remaining`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{item.daysOverdue}d overdue</span>
            </div>
          </div>
        ))
      ) : (
        <EmptyState text="No overdue items" />
      )}
      {!expandedList && overdueItems.length > VISIBLE_COUNT && (
        <button onClick={() => setExpandedList(true)} className="mt-2 text-xs text-red-600 font-semibold hover:underline">Show all {overdueItems.length}</button>
      )}
    </SectionCard>
  );
}

const STAT_ACCENT: Record<string, string> = {
  applications: "bg-amber-500",
  loans: "bg-emerald-500",
  payments: "bg-blue-500",
  machines: "bg-indigo-500",
  members: "bg-purple-500",
  supplies: "bg-orange-500",
};

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <div
      className="animate-slideUp relative overflow-hidden rounded-xl border border-[#e2ebe6] bg-white p-4 shadow-sm"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <div className={`absolute left-0 top-0 h-full w-[3px] ${accent}`} />
      <div className="flex items-start justify-between">
        <div className="pl-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#5a7267]">
            {label}
          </p>
          <p
            className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#0f2318]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-[11px] text-[#5a7267]">{sub}</p>
          )}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0f7eb]">
          <Icon size={16} className="text-[#1b5e3b]" />
        </div>
      </div>
    </div>
  );
}

function SecretaryLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <div className="h-14 bg-[#1b5e3b]" />
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[#e2ebe6]" />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-[#e2ebe6] bg-white" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-[#e2ebe6] bg-white" />
      </div>
    </div>
  );
}

type Tab = "overview" | Section | "admin-actions";

export default function OfficerDashboard({
  role = "SECRETARY",
}: {
  role?: "SECRETARY" | "PRESIDENT";
}) {
  const workspaceLabel = role === "PRESIDENT" ? "President workspace" : "Secretary workspace";
  const dashboardTitle =
    role === "PRESIDENT" ? "President dashboard" : "Secretary dashboard";
  const avatarLetter = role === "PRESIDENT" ? "P" : "S";
  const [data, setData] = useState<SecretaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [detailMachine, setDetailMachine] = useState<Machine | null>(null);
  const [formMachine, setFormMachine] = useState<Machine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [viewRequest, setViewRequest] = useState<MachineRequestInfo | null>(null);
  const [viewRejectedRequest, setViewRejectedRequest] = useState<MachineRequestInfo | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<Record<Section, boolean>>({
    applications: false,
    members: false,
    loans: false,
    payments: false,
    machines: false,
    supplies: false,
    reports: false,
    announcements: false,
    sms: false,
    overdue: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/secretary/stats");
      if (res.ok) setData(await res.json());
    } catch {
      console.error("Failed to fetch secretary data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => { fetchData(); }, 30000);
    const onFocus = () => { fetchData(); };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchData]);

  const now = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    if (!data) return null;
    const pendingApps = data.applications.filter((a) => a.status === "PENDING");
    const pendingLoans = data.loans.filter((l) => l.status === "PENDING");
    const activeLoans = data.loans.filter((l) => l.status === "APPROVED" || l.status === "ACTIVE");
    const overdueLoans = data.loans.filter((l) => l.status === "ACTIVE" && l.due && new Date(l.due) < now);
    const pendingPayments = data.payments.filter((p) => p.status === "PENDING");
    const lowStock = data.supplies.filter((s) => s.stock <= 30);
    return {
      pendingApps: pendingApps.length,
      activeLoans: activeLoans.length,
      pendingLoans: pendingLoans.length,
      pendingPayments: pendingPayments.length,
      machinesInUse: data.summary.totalBorrowedMachines,
      totalMembers: data.summary.totalMembers,
      overdueLoans: overdueLoans.length,
      lowStock: lowStock.length,
    };
  }, [data, now]);

  const badges = useMemo<Record<Section, number>>(() => {
    if (!data) {
      return {
        applications: 0,
        members: 0,
        loans: 0,
        payments: 0,
        machines: 0,
        supplies: 0,
        reports: 0,
        announcements: 0,
        sms: 0,
        overdue: 0,
      };
    }
    const machinePending = data.machines.reduce(
      (acc, m) => acc + m.requests.filter((r) =>
        (PENDING_MACHINE_STATUSES as readonly string[]).includes(r.status),
      ).length,
      0,
    );
    const supplyPending = data.supplies.reduce(
      (acc, s) => acc + s.transactions.filter((t) => t.status === "PENDING").length,
      0,
    );
    return {
      applications: data.applications.filter((a) => a.status === "PENDING").length,
      members: 0,
      loans: data.loans.filter((l) => l.status === "PENDING").length,
      payments: data.payments.filter((p) => p.status === "PENDING").length,
      machines: machinePending,
      supplies: supplyPending,
      reports: 0,
      announcements: data.posts.filter((p) => !p.published).length,
      sms: 0,
      overdue: 0,
    };
  }, [data]);

  function togglePendingFilter(section: Section) {
    setPendingFilter((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function openSection(section: Section) {
    setActiveTab(section);
    if (badges[section] > 0) {
      setPendingFilter((prev) => ({ ...prev, [section]: true }));
    }
  }

  const recentActivity = useMemo(() => {
    if (!data) return [];
    const items: { id: string; text: string; time: string; kind: "application" | "loan" | "payment" | "machine" | "supply" }[] = [];
    data.applications.slice(0, 3).forEach((a) => {
      items.push({ id: `app-${a.id}`, text: `${a.fullName} — ${a.status.toLowerCase()} application`, time: new Date(a.createdAt).toLocaleDateString(), kind: "application" });
    });
    data.loans.slice(0, 4).forEach((l) => {
      items.push({ id: `loan-${l.id}`, text: `${l.borrower.name} — ${l.status.toLowerCase()} ${l.name} loan`, time: new Date(l.createdAt).toLocaleDateString(), kind: "loan" });
    });
    data.payments.slice(0, 4).forEach((p) => {
      items.push({ id: `pay-${p.id}`, text: `${p.user.name} — ₱${p.amount.toLocaleString()} ${p.status.toLowerCase()}`, time: new Date(p.createdAt).toLocaleDateString(), kind: "payment" });
    });
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
  }, [data]);

  const searchLower = searchQuery.toLowerCase();
  const searchedMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => !searchLower || m.name.toLowerCase().includes(searchLower) || m.username.toLowerCase().includes(searchLower));
  }, [data, searchLower]);
  const searchedApplications = useMemo(() => {
    if (!data) return [];
    return data.applications.filter((a) => !searchLower || a.fullName.toLowerCase().includes(searchLower));
  }, [data, searchLower]);

  function handleClickMachine(machine: Machine) { setDetailMachine(machine); }
  function handleEditFromDetail(machine: Machine) { setDetailMachine(null); setFormMachine(machine); setShowForm(true); }
  function handleDeleteFromDetail(machine: Machine) { setDetailMachine(null); setDeleteConfirm(machine); }

  async function handleDecideRequest(requestId: string, action: MachineRequestAction, message?: string) {
    try {
      const res = await fetch(`/api/machines/request/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, message }) });
      const result = await res.json();
      if (res.ok) {
        await fetchData();
        const newStatus = { approve: "APPROVED", reject: "REJECTED", start: "IN_USE", return: "RETURNED", overdue: "OVERDUE", remind: undefined, rejectReturn: "IN_USE", ping: undefined }[action];
        if (newStatus) {
          setDetailMachine((prev) => prev ? { ...prev, requests: prev.requests.map((r) => r.id === requestId ? { ...r, status: newStatus, rejectionReason: action === "reject" ? (message ?? r.rejectionReason) : r.rejectionReason } : r) } : null);
          setViewRequest((prev) => { if (!prev || prev.id !== requestId) return prev; return { ...prev, status: newStatus, rejectionReason: action === "reject" ? (message ?? prev.rejectionReason) : prev.rejectionReason }; });
        }
      } else { alert(result.error || `Failed to ${action} request`); }
    } catch { alert(`Failed to ${action} request`); }
  }

  function handleAddMachine() { setFormMachine(null); setShowForm(true); }

  async function handleDeleteMachine() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/machines/${deleteConfirm.id}`, { method: "DELETE" });
      const result = await res.json();
      if (res.ok) { setDeleteConfirm(null); fetchData(); } else { alert(result.error || "Failed to delete machine"); }
    } catch { alert("Failed to delete machine"); } finally { setDeleting(false); }
  }

  async function handleLoanAction(loanId: string, action: "approve" | "reject", reason?: string) {
    setBusy(loanId);
    try {
      const res = await fetch(`/api/secretary/loans/${loanId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || `Failed to ${action} loan`); }
    } catch { alert(`Failed to ${action} loan`); } finally { setBusy(null); }
  }

  async function handlePaymentAction(paymentId: string, action: "verify" | "reject", reason?: string) {
    setBusy(paymentId);
    try {
      const res = await fetch(`/api/secretary/payments/${paymentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || `Failed to ${action} payment`); }
    } catch { alert(`Failed to ${action} payment`); } finally { setBusy(null); }
  }

  async function handleMemberEdit(memberId: string, payload: { name: string; role: string; active: boolean }) {
    setBusy(memberId);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || "Failed to update member"); }
    } catch { alert("Failed to update member"); } finally { setBusy(null); }
  }

  async function handleAddSupply(d: { productName: string; price: number; quantity: number; loanLimitPerHectare: number | null }) {
    setBusy("supply-add");
    try {
      const res = await fetch("/api/admin/supplies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || "Failed to add supply"); }
    } catch { alert("Failed to add supply"); } finally { setBusy(null); }
  }

  async function handleUpdateSupply(supplyId: string, d: { productName: string; price: number; quantity: number; loanLimitPerHectare: number | null }) {
    setBusy(supplyId);
    try {
      const res = await fetch(`/api/admin/supplies/${supplyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || "Failed to update supply"); }
    } catch { alert("Failed to update supply"); } finally { setBusy(null); }
  }

  async function handleSupplyRequestAction(requestId: string, action: "approve" | "complete" | "reject", reason?: string) {
    setBusy(requestId);
    try {
      const res = await fetch(`/api/admin/supply-requests/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || `Failed to ${action} request`); }
    } catch { alert(`Failed to ${action} request`); } finally { setBusy(null); }
  }

  async function handleGenerateReport(type: string, title?: string, filters?: { from?: string; to?: string; memberId?: string; statuses?: string[] }) {
    setBusy("report");
    try {
      const res = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, title, ...(filters ?? {}) }) });
      const result = await res.json();
      if (res.ok) { await fetchData(); return result as ReportRecord; } else { alert(result.error || "Failed to generate report"); }
    } catch { alert("Failed to generate report"); } finally { setBusy(null); }
    return null;
  }

  async function handlePreviewReport(type: string, filters?: { from?: string; to?: string; memberId?: string; statuses?: string[] }) {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, preview: true, ...(filters ?? {}) }),
      });
      const result = await res.json();
      if (res.ok) return result as ReportRecord;
      return null;
    } catch {
      return null;
    }
  }

  async function handleCreatePost(title: string, content: string, published: boolean) {
    setBusy("post-create");
    try {
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, published }) });
      const result = await res.json();
      if (res.ok) { await fetchData(); } else { alert(result.error || "Failed to create announcement"); }
    } catch { alert("Failed to create announcement"); } finally { setBusy(null); }
  }

  async function handleTogglePublish(postId: string, currentPublished: boolean) {
    setBusy(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !currentPublished }) });
      if (res.ok) { await fetchData(); } else { const r = await res.json(); alert(r.error || "Failed to update announcement"); }
    } catch { alert("Failed to update announcement"); } finally { setBusy(null); }
  }

  async function handleDeletePost(postId: string) {
    setBusy(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) { await fetchData(); } else { const r = await res.json(); alert(r.error || "Failed to delete announcement"); }
    } catch { alert("Failed to delete announcement"); } finally { setBusy(null); }
  }

  if (loading) return <SecretaryLoadingSkeleton />;

  const nowDate = new Date();
  const formattedDate = nowDate.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = nowDate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  const ALL_TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "admin-actions", label: "Admin Actions", icon: HandHelping },
    ...SECTIONS.map((s) => ({ key: s as Tab, label: SECTION_META[s].label, icon: SECTION_META[s].icon })),
  ];

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b5e3b] text-white shadow-lg shadow-[#0f2318]/10">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d6ed9f] text-[#1b5e3b]"><IconLeaf className="h-4 w-4" /></span>
              <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>FarmCoop</span>
            </Link>
            <div className="hidden h-5 w-px bg-white/20 sm:block" />
            <p className="hidden text-xs font-medium text-white/70 sm:block">{workspaceLabel}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-white/60 md:flex">
              <Calendar size={13} /><span>{formattedDate}</span><span className="text-white/30">·</span><Clock size={13} /><span style={{ fontFamily: "var(--font-mono)" }}>{formattedTime}</span>
            </div>
            <div className="relative hidden sm:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input type="text" placeholder="Search members, loans…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-48 rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 text-xs text-white placeholder-white/40 outline-none transition-all focus:w-56 focus:border-white/40 focus:bg-white/15" />
            </div>
            <Link href="/dashboard/notifications" className="relative rounded-lg p-2 transition-colors hover:bg-white/15" aria-label="Notifications"><Bell size={18} /></Link>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/15">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#2d8a56] text-[10px] font-bold text-white">{avatarLetter}</div>
                <ChevronDown size={14} className="text-white/60" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-[#e2ebe6] bg-white py-1 shadow-2xl">
                    <Link href="/registration" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#0f2318] transition-colors hover:bg-[#f0f7eb]">Edit profile</Link>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#0f2318] transition-colors hover:bg-[#f0f7eb]">Member dashboard</Link>
                    <div className="my-1 h-px bg-[#e2ebe6]" />
                    <form action={logout}><button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"><LogOut size={13} />Sign out</button></form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-xl font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-display)" }}>{dashboardTitle}</h1>
          <p className="mt-0.5 text-sm text-[#5a7267]">Applications, members, loans, payments, machines, supplies, and announcements</p>
        </div>

        {notice && (
          <div role="status" aria-live="polite" className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${notice.kind === "success" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"}`}>
            {notice.kind === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{notice.text}
          </div>
        )}

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Pending Applications" value={stats.pendingApps} sub="Awaiting review" accent="bg-amber-500" icon={FileText} delay={0} />
            <StatCard label="Active Loans" value={stats.activeLoans} sub={`${stats.pendingLoans} pending`} accent="bg-emerald-500" icon={Banknote} delay={50} />
            <StatCard label="Pending Payments" value={stats.pendingPayments} sub="Need verification" accent="bg-blue-500" icon={ClipboardCheck} delay={100} />
            <StatCard label="Machines In Use" value={stats.machinesInUse} sub="Currently borrowed" accent="bg-indigo-500" icon={Tractor} delay={150} />
            <StatCard label="Total Members" value={stats.totalMembers} sub="Active cooperative" accent="bg-purple-500" icon={Users} delay={200} />
            <StatCard label="Low Stock Items" value={stats.lowStock} sub="Below 30 units" accent="bg-orange-500" icon={Package} delay={250} />
          </div>
        )}

        <div className="mb-5 flex gap-1 overflow-x-auto scrollbar-hide">
          {ALL_TABS.map((t) => {
            const Icon = t.icon;
            const isSection = (SECTIONS as readonly string[]).includes(t.key);
            const count = isSection ? badges[t.key as Section] : 0;
            return (
              <button
                key={t.key}
                onClick={() => (isSection ? openSection(t.key as Section) : setActiveTab(t.key))}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${activeTab === t.key ? "bg-[#1b5e3b] text-white shadow-md shadow-[#1b5e3b]/20" : "bg-white text-[#5a7267] hover:bg-[#f0f7eb] hover:text-[#1b5e3b] border border-[#e2ebe6]"}`}
              >
                <Icon size={14} />
                <span className="relative">
                  {t.label}
                  {isSection && count > 0 && (
                    <span className="absolute -right-2.5 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            {activeTab === "overview" && data && (
              <>
                <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-fadeIn">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Pending Applications</h3>
                  {data.applications.filter((a) => a.status === "PENDING").length === 0 ? (
                    <p className="py-4 text-center text-sm text-[#5a7267]">No pending applications</p>
                  ) : (
                    <div className="space-y-2">
                      {data.applications.filter((a) => a.status === "PENDING").slice(0, 5).map((app) => (
                        <button key={app.id} onClick={() => setDetailApp(app)} className="flex w-full items-center justify-between rounded-lg border border-[#e2ebe6] bg-[#fafdf9] px-3.5 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50/30 active:scale-[0.99]">
                          <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#0f2318] truncate">{app.fullName}</p><p className="text-[11px] text-[#5a7267]">{app.cropType} · {app.farmSize} ha</p></div>
                          <span className="ml-2 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">Review</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-fadeIn">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Pending Payments</h3>
                  {data.payments.filter((p) => p.status === "PENDING").length === 0 ? (
                    <p className="py-4 text-center text-sm text-[#5a7267]">No pending payments</p>
                  ) : (
                    <div className="space-y-2">
                      {data.payments.filter((p) => p.status === "PENDING").slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#e2ebe6] bg-[#fafdf9] px-3.5 py-2.5">
                          <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[#0f2318] truncate">{p.user.name}</p><p className="text-[11px] text-[#5a7267]">₱{p.amount.toLocaleString()} · {p.loan?.name ?? "Payment"}</p></div>
                          <span className="ml-2 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">Verify</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {stats && stats.overdueLoans > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm animate-fadeIn">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-red-600" /><h3 className="text-xs font-semibold uppercase tracking-wider text-red-700">Overdue Loans</h3></div>
                    <p className="text-sm text-red-800">{stats.overdueLoans} loan{stats.overdueLoans > 1 ? "s" : ""} past due date</p>
                  </div>
                )}

                {stats && stats.lowStock > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm animate-fadeIn">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-orange-600" /><h3 className="text-xs font-semibold uppercase tracking-wider text-orange-700">Low Stock Alert</h3></div>
                    <p className="text-sm text-orange-800">{stats.lowStock} supply item{stats.lowStock > 1 ? "s" : ""} below 30 units</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "admin-actions" && (
              <AdminActionsPanel onDone={fetchData} />
            )}

            {activeTab === "applications" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
                  <div><h3 className="text-sm font-bold text-[#0f2318]">Membership Applications</h3><p className="text-[11px] text-[#5a7267]">{data.applications.length} total · {data.applications.filter((a) => a.status === "PENDING").length} pending</p></div>
                  <PendingOnlyToggle active={pendingFilter.applications} count={badges.applications} onToggle={() => togglePendingFilter("applications")} />
                </div>
                <div className="p-4 space-y-2">
                  {(pendingFilter.applications ? searchedApplications.filter((a) => a.status === "PENDING") : searchedApplications).length > 0 ? (pendingFilter.applications ? searchedApplications.filter((a) => a.status === "PENDING") : searchedApplications).map((app) => (
                    <button key={app.id} onClick={() => setDetailApp(app)} className="flex w-full items-center justify-between rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.99]">
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#173a2b] truncate">{app.fullName}</p><p className="text-xs text-[#718176]">{app.cropType} · Applied {new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div>
                      <span className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${APP_STATUS_STYLE[app.status] || ""}`}>{app.status.charAt(0) + app.status.slice(1).toLowerCase()}</span>
                    </button>
                  )) : <EmptyState text={pendingFilter.applications ? "No pending applications" : "No applications found"} />}
                </div>
              </div>
            )}

            {activeTab === "members" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#e2ebe6] px-5 py-4"><h3 className="text-sm font-bold text-[#0f2318]">Members Directory</h3><p className="text-[11px] text-[#5a7267]">{data.members.length} members</p></div>
                <div className="p-4">
                  <MembersSection items={searchedMembers} expanded={true} onToggle={() => {}} onEdit={handleMemberEdit} busy={busy} />
                </div>
              </div>
            )}

            {activeTab === "loans" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
                  <div><h3 className="text-sm font-bold text-[#0f2318]">Loan Management</h3><p className="text-[11px] text-[#5a7267]">{data.loans.length} total loans</p></div>
                  <PendingOnlyToggle active={pendingFilter.loans} count={badges.loans} onToggle={() => togglePendingFilter("loans")} />
                </div>
                <div className="p-4">
                  <LoansSection items={data.loans} expanded={true} onToggle={() => {}} onAction={handleLoanAction} busy={busy} pendingOnly={pendingFilter.loans} />
                </div>
              </div>
            )}

            {activeTab === "payments" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
                  <div><h3 className="text-sm font-bold text-[#0f2318]">Payment Verification</h3><p className="text-[11px] text-[#5a7267]">{data.payments.length} total · {data.payments.filter((p) => p.status === "PENDING").length} pending</p></div>
                  <PendingOnlyToggle active={pendingFilter.payments} count={badges.payments} onToggle={() => togglePendingFilter("payments")} />
                </div>
                <div className="p-4">
                  <PaymentsSection items={pendingFilter.payments ? data.payments.filter((p) => p.status === "PENDING") : data.payments} expanded={true} onToggle={() => {}} onAction={handlePaymentAction} onImageClick={(src, alt) => setImageModal({ src, alt })} busy={busy} />
                </div>
              </div>
            )}

            {activeTab === "machines" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[#e2ebe6] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div><h3 className="text-sm font-bold text-[#0f2318]">Equipment Management</h3><p className="text-[11px] text-[#5a7267]">{data.machines.length} machines · {data.machines.filter((m) => m.isBorrowed).length} in use</p></div>
                    <PendingOnlyToggle active={pendingFilter.machines} count={badges.machines} onToggle={() => togglePendingFilter("machines")} />
                  </div>
                  <button onClick={handleAddMachine} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1b5e3b] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#15503a] hover:shadow-md active:scale-[0.98]"><Plus size={14} />Add Machine</button>
                </div>
                <div className="p-4">
                  <MachinesSection items={pendingFilter.machines ? data.machines.filter(hasPendingMachineAction) : data.machines} expanded={true} onToggle={() => {}} onAdd={handleAddMachine} onClickMachine={handleClickMachine} onImageClick={(src, alt) => setImageModal({ src, alt })} />
                </div>
              </div>
            )}

            {activeTab === "supplies" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
                  <div><h3 className="text-sm font-bold text-[#0f2318]">Supply Inventory</h3><p className="text-[11px] text-[#5a7267]">{data.supplies.length} items · {data.supplies.filter((s) => s.stock === 0).length} out of stock</p></div>
                  <PendingOnlyToggle active={pendingFilter.supplies} count={badges.supplies} onToggle={() => togglePendingFilter("supplies")} />
                </div>
                <div className="p-4">
                  <SuppliesSection items={pendingFilter.supplies ? data.supplies.filter((s) => s.transactions.some((t) => t.status === "PENDING")) : data.supplies} expanded={true} onToggle={() => {}} onAddSupply={handleAddSupply} onUpdateSupply={handleUpdateSupply} onActionRequest={handleSupplyRequestAction} busy={busy} />
                </div>
              </div>
            )}

            {activeTab === "reports" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#e2ebe6] px-5 py-4"><h3 className="text-sm font-bold text-[#0f2318]">Reports & Analytics</h3><p className="text-[11px] text-[#5a7267]">{data.reports.length} reports generated</p></div>
                <div className="p-4">
                  <ReportsSection items={data.reports} expanded={true} onToggle={() => {}} onGenerate={handleGenerateReport} onPreview={handlePreviewReport} busy={busy} />
                </div>
              </div>
            )}

            {activeTab === "announcements" && data && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between gap-3 border-b border-[#e2ebe6] px-5 py-4">
                  <div><h3 className="text-sm font-bold text-[#0f2318]">Announcements</h3><p className="text-[11px] text-[#5a7267]">{data.posts.length} posts · {data.posts.filter((p) => p.published).length} published</p></div>
                  <PendingOnlyToggle active={pendingFilter.announcements} count={badges.announcements} onToggle={() => togglePendingFilter("announcements")} />
                </div>
                <div className="p-4">
                  <AnnouncementsSection items={pendingFilter.announcements ? data.posts.filter((p) => !p.published) : data.posts} expanded={true} onToggle={() => {}} onCreate={handleCreatePost} onTogglePublish={handleTogglePublish} onDelete={handleDeletePost} busy={busy} />
                </div>
              </div>
            )}

            {activeTab === "sms" && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#e2ebe6] px-5 py-4"><h3 className="text-sm font-bold text-[#0f2318]">SMS / Notifications</h3><p className="text-[11px] text-[#5a7267]">Send and track SMS notifications</p></div>
                <div className="p-4">
                  <SmsSection expanded={true} onToggle={() => {}} />
                </div>
              </div>
            )}

            {activeTab === "overdue" && (
              <div className="rounded-xl border border-[#e2ebe6] bg-white shadow-sm animate-fadeIn">
                <div className="border-b border-[#e2ebe6] px-5 py-4"><h3 className="text-sm font-bold text-[#0f2318]">Overdue Obligations</h3><p className="text-[11px] text-[#5a7267]">Loans and machines past their due dates</p></div>
                <div className="p-4">
                  <OverdueSection expanded={true} onToggle={() => {}} />
                </div>
              </div>
            )}
          </div>

          <aside className="hidden lg:block space-y-4">
            <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-slideUp">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Quick Summary</h3>
              <div className="space-y-3">
                {stats && (
                  <>
                    <div className="flex items-center justify-between"><span className="text-xs text-[#5a7267]">Pending Applications</span><span className="font-mono text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-mono)" }}>{stats.pendingApps}</span></div>
                    <div className="h-px bg-[#e2ebe6]" />
                    <div className="flex items-center justify-between"><span className="text-xs text-[#5a7267]">Active Loans</span><span className="font-mono text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-mono)" }}>{stats.activeLoans}</span></div>
                    <div className="h-px bg-[#e2ebe6]" />
                    <div className="flex items-center justify-between"><span className="text-xs text-[#5a7267]">Pending Payments</span><span className="font-mono text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-mono)" }}>{stats.pendingPayments}</span></div>
                    <div className="h-px bg-[#e2ebe6]" />
                    <div className="flex items-center justify-between"><span className="text-xs text-[#5a7267]">Machines In Use</span><span className="font-mono text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-mono)" }}>{stats.machinesInUse}</span></div>
                    <div className="h-px bg-[#e2ebe6]" />
                    <div className="flex items-center justify-between"><span className="text-xs text-[#5a7267]">Total Members</span><span className="font-mono text-sm font-bold text-[#0f2318]" style={{ fontFamily: "var(--font-mono)" }}>{stats.totalMembers}</span></div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-slideUp" style={{ animationDelay: "100ms" }}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.length > 0 ? recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.kind === "application" ? "bg-amber-500" : item.kind === "loan" ? "bg-emerald-500" : item.kind === "payment" ? "bg-blue-500" : item.kind === "machine" ? "bg-indigo-500" : "bg-orange-500"}`} />
                    <div className="min-w-0 flex-1"><p className="text-xs text-[#0f2318] leading-relaxed">{item.text}</p><p className="text-[10px] text-[#5a7267]">{item.time}</p></div>
                  </div>
                )) : <p className="text-xs text-[#5a7267]">No recent activity</p>}
              </div>
            </div>

            <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-slideUp" style={{ animationDelay: "200ms" }}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Today&apos;s Priorities</h3>
              <div className="space-y-2">
                {stats && stats.pendingApps > 0 && (
                  <button onClick={() => openSection("applications")} className="flex w-full items-center gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-left transition hover:bg-amber-100/70 active:scale-[0.99]">
                    <FileText size={14} className="text-amber-600 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-amber-800">{stats.pendingApps} application{stats.pendingApps > 1 ? "s" : ""} to review</p></div>
                    <ArrowUpRight size={12} className="text-amber-500 shrink-0" />
                  </button>
                )}
                {stats && stats.pendingPayments > 0 && (
                  <button onClick={() => openSection("payments")} className="flex w-full items-center gap-2.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-left transition hover:bg-blue-100/70 active:scale-[0.99]">
                    <ClipboardCheck size={14} className="text-blue-600 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-blue-800">{stats.pendingPayments} payment{stats.pendingPayments > 1 ? "s" : ""} to verify</p></div>
                    <ArrowUpRight size={12} className="text-blue-500 shrink-0" />
                  </button>
                )}
                {stats && stats.pendingLoans > 0 && (
                  <button onClick={() => openSection("loans")} className="flex w-full items-center gap-2.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-left transition hover:bg-emerald-100/70 active:scale-[0.99]">
                    <Banknote size={14} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-emerald-800">{stats.pendingLoans} loan{stats.pendingLoans > 1 ? "s" : ""} to process</p></div>
                    <ArrowUpRight size={12} className="text-emerald-500 shrink-0" />
                  </button>
                )}
                {stats && stats.overdueLoans > 0 && (
                  <button onClick={() => openSection("loans")} className="flex w-full items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-left transition hover:bg-red-100/70 active:scale-[0.99]">
                    <AlertTriangle size={14} className="text-red-600 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-red-800">{stats.overdueLoans} overdue loan{stats.overdueLoans > 1 ? "s" : ""}</p></div>
                    <ArrowUpRight size={12} className="text-red-500 shrink-0" />
                  </button>
                )}
                {(!stats || (stats.pendingApps === 0 && stats.pendingPayments === 0 && stats.pendingLoans === 0 && stats.overdueLoans === 0)) && (
                  <div className="py-3 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-400" /><p className="mt-2 text-xs text-[#5a7267]">All caught up!</p></div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="h-6" />
      </main>

      {detailMachine && <MachineDetailModal machine={detailMachine} onClose={() => setDetailMachine(null)} onEdit={handleEditFromDetail} onDelete={handleDeleteFromDetail} onViewRequest={setViewRequest} onViewRejected={setViewRejectedRequest} onLifecycle={handleDecideRequest} />}
      {viewRequest && <RequestDetailModal request={viewRequest} onClose={() => setViewRequest(null)} onDecide={handleDecideRequest} />}
      {viewRejectedRequest && <RejectionDetailModal request={viewRejectedRequest} onClose={() => setViewRejectedRequest(null)} />}
      {detailApp && <ApplicationDetailModal application={detailApp} onClose={() => setDetailApp(null)} />}
      {showForm && <MachineFormModal machine={formMachine} onClose={() => { setShowForm(false); setFormMachine(null); }} onSave={fetchData} />}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4"><Trash2 size={20} className="text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Machine</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirm.name}</span>? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="flex-1 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-2xl font-bold transition">Cancel</button>
                <button onClick={handleDeleteMachine} disabled={deleting} className="flex-1 py-3 bg-red-600 text-white hover:bg-red-700 rounded-2xl font-bold transition disabled:opacity-50">{deleting ? "Deleting..." : "Delete"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {imageModal && <ImageModal src={imageModal.src} alt={imageModal.alt} onClose={() => setImageModal(null)} />}
    </div>
  );
}
