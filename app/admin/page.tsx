"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImageModal } from "@/components/ImageModal";
import { ReportModal } from "@/components/ReportModal";
import { runAdminMutation } from "@/lib/admin-mutation";
import { Money } from "@/components/Money";

type Role = "APPLICANT" | "MEMBER" | "TREASURER" | "PRESIDENT" | "SECRETARY";
type Tab =
  | "loans"
  | "payments"
  | "applicationPayments"
  | "membershipApplications"
  | "supplies"
  | "members"
  | "reports"
  | "posts";
type User = { id: string; name: string | null; username: string; role: Role };
type Notice = { kind: "success" | "error"; text: string };

interface Loan {
  id: string;
  borrower: { name: string | null; username: string };
  amount: number;
  remainingBalance: number;
  termMonths: number;
  purpose: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  user: { name: string | null; username: string };
  loan: { name: string } | null;
  amount: number;
  receiptUrl: string | null;
  referenceNo: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

interface SupplyRequest {
  id: string;
  quantity: number;
  totalPrice: number;
  type: string;
  status: string;
  rejectionReason: string | null;
  user: { name: string | null; username: string };
}

interface Supply {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  loanLimitPerHectare: number | null;
  transactions: SupplyRequest[];
}

interface Member {
  id: string;
  name: string | null;
  username: string;
  role: Role;
  active: boolean;
  createdAt: string;
  application?: { contact?: string; cropType?: string; status?: string } | null;
}

interface Report {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown> | null;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
}

type AuditUser = { id: string; name: string | null; username: string; role: Role };

interface ApplicationFee {
  id: string;
  user: { id: string; name: string; username: string };
  application: {
    id: string;
    fullName: string;
    contact: string | null;
    status: string;
    createdAt: string;
    username: string;
  } | null;
  amount: number;
  receiptUrl: string | null;
  referenceNo: string | null;
  paymentMethod: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  paidAt: string | null;
  proofUploadedBy: AuditUser | null;
  proofUploadedAt: string | null;
  verifiedBy: AuditUser | null;
  verifiedAt: string | null;
  declinedBy: AuditUser | null;
  declinedAt: string | null;
}

interface ApplicationAwaitingPayment {
  id: string;
  fullName: string;
  contact: string | null;
  status: string;
  createdAt: string;
}

interface MembershipApplication {
  id: string;
  fullName: string;
  contact: string | null;
  status: string;
  createdAt: string;
  reviewedBy: AuditUser | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  rejectionDetails: string | null;
  payment: {
    id: string;
    status: string;
    paymentMethod: string;
    verifiedAt: string | null;
    verifiedBy: AuditUser | null;
  } | null;
}

interface MembershipCounts {
  pendingPaymentApprovals: number;
  awaitingReview: number;
  denied: number;
  approvedMembers: number;
}

const fieldClass = "rounded-xl border border-[#dce5d9] bg-white px-3 py-2 text-sm text-[#173a2b] outline-none focus:border-[#39733e] focus:ring-2 focus:ring-[#dcefd0]";
const buttonClass = "rounded-xl bg-[#26633f] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#174b36] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-xl border border-[#cddbc9] bg-white px-3.5 py-2 text-xs font-bold text-[#315646] transition hover:bg-[#f0f7eb] disabled:opacity-50";

function getSecureProofUrl(receiptUrl: string | null) {
  if (!receiptUrl) return null;

  try {
    const url = new URL(receiptUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? data.message ?? "Request failed");
  return data;
}

const ROLE_LABELS: Record<Role, string> = {
  APPLICANT: "Applicant",
  MEMBER: "Member",
  TREASURER: "Treasurer",
  PRESIDENT: "President",
  SECRETARY: "Secretary",
};

function auditPerson(user: AuditUser | null) {
  if (!user) return "—";
  return `${user.name ?? user.username} — ${ROLE_LABELS[user.role]}`;
}

function formatAuditDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditRow({ label, user, at }: { label: string; user: AuditUser | null; at: string | null }) {
  return (
    <p className="text-xs text-[#496558]">
      <span className="font-bold text-[#315646]">{label}:</span> {auditPerson(user)}
      {at ? <span className="text-[#8fa594]"> · {formatAuditDate(at)}</span> : null}
    </p>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("members");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [applicationFees, setApplicationFees] = useState<ApplicationFee[]>([]);
  const [applicationsAwaitingPayment, setApplicationsAwaitingPayment] = useState<
    ApplicationAwaitingPayment[]
  >([]);
  const [membershipApplications, setMembershipApplications] = useState<
    MembershipApplication[]
  >([]);
  const [membershipCounts, setMembershipCounts] = useState<MembershipCounts>({
    pendingPaymentApprovals: 0,
    awaitingReview: 0,
    denied: 0,
    approvedMembers: 0,
  });
  const [feeAmount, setFeeAmount] = useState(0);
  const [memFilter, setMemFilter] = useState("PENDING_APPLICATION_REVIEW");
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [feeSearch, setFeeSearch] = useState("");
  const [feeStatus, setFeeStatus] = useState("");
  const [onsiteTarget, setOnsiteTarget] = useState<ApplicationAwaitingPayment | null>(null);
  const [onsiteProof, setOnsiteProof] = useState<File | null>(null);
  const [onsiteRemarks, setOnsiteRemarks] = useState("");
  const onsiteInputRef = useRef<HTMLInputElement>(null);

  const tabs = useMemo(() => {
    if (!user) return [] as Tab[];
    const result: Tab[] = ["members", "reports", "posts"];
    if (["PRESIDENT", "TREASURER"].includes(user.role)) result.unshift("loans", "payments");
    if (user.role === "PRESIDENT") result.splice(result.indexOf("members"), 0, "applicationPayments", "membershipApplications");
    if (["SECRETARY", "TREASURER"].includes(user.role)) result.splice(result.includes("payments") ? 2 : 0, 0, "supplies");
    return result;
  }, [user]);

  const loadTab = useCallback(async (selected: Tab) => {
    const endpoints: Record<Tab, string> = {
      loans: "/api/admin/loans",
      payments: "/api/admin/payments",
      applicationPayments: "/api/admin/application-payments",
      membershipApplications: "/api/admin/membership-applications",
      supplies: "/api/admin/supplies",
      members: "/api/admin/members",
      reports: "/api/admin/reports",
      posts: "/api/posts?includeDrafts=true",
    };
    setLoading(true);
    try {
      const query =
        selected === "applicationPayments"
          ? `?search=${encodeURIComponent(feeSearch.trim())}${feeStatus ? `&status=${encodeURIComponent(feeStatus)}` : ""}`
          : "";
      const data = await requestJson(`${endpoints[selected]}${query}`);
      if (selected === "loans") setLoans(data);
      if (selected === "payments") setPayments(data);
      if (selected === "applicationPayments") {
        setApplicationFees(data.payments ?? []);
        setApplicationsAwaitingPayment(data.pendingApplications ?? []);
        setFeeAmount(Number(data.feeAmount) || 0);
      }
      if (selected === "membershipApplications") {
        setMembershipApplications(data.applications ?? []);
        setMembershipCounts(
          data.counts ?? {
            pendingPaymentApprovals: 0,
            awaitingReview: 0,
            denied: 0,
            approvedMembers: 0,
          },
        );
      }
      if (selected === "supplies") setSupplies(data);
      if (selected === "members") setMembers(data.members ?? data);
      if (selected === "reports") setReports(data.reports ?? data);
      if (selected === "posts") setPosts(data.posts ?? data);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load records" });
    } finally {
      setLoading(false);
    }
  }, [feeSearch, feeStatus]);

  useEffect(() => {
    requestJson("/api/me")
      .then((currentUser: User) => {
        setUser(currentUser);
        const initial: Tab = ["PRESIDENT", "TREASURER"].includes(currentUser.role) ? "loans" : currentUser.role === "SECRETARY" ? "supplies" : "members";
        setTab(initial);
        return loadTab(initial);
      })
      .catch((error) => {
        setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load account" });
        setLoading(false);
      });
  }, [loadTab]);

  async function mutate(key: string, url: string, body: unknown, success: string, method = "PATCH") {
    setBusy(key);
    setNotice(null);
    try {
      await runAdminMutation({
        request: () =>
          requestJson(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        refresh: () => loadTab(tab),
        onSuccess: () => setNotice({ kind: "success", text: success }),
        onError: (error) =>
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Action failed",
          }),
      });
    } finally {
      setBusy(null);
    }
  }

  function rejectReason() {
    return window.prompt("Enter the reason for rejection:");
  }

  async function recordOnsite() {
    if (!onsiteTarget) return;
    const target = onsiteTarget;
    setBusy(target.id);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("applicationId", target.id);
      if (onsiteRemarks.trim()) formData.set("remarks", onsiteRemarks.trim());
      if (onsiteProof) formData.set("proofOfPayment", onsiteProof);
      await runAdminMutation({
        request: () => requestJson("/api/admin/application-payments/record-onsite", { method: "POST", body: formData }),
        refresh: () => loadTab(tab),
        onSuccess: () => setNotice({ kind: "success", text: "On-site payment recorded and application advanced." }),
        onError: (error) => setNotice({ kind: "error", text: error instanceof Error ? error.message : "Action failed" }),
      });
      setOnsiteTarget(null);
      setOnsiteProof(null);
      setOnsiteRemarks("");
      if (onsiteInputRef.current) onsiteInputRef.current.value = "";
    } finally {
      setBusy(null);
    }
  }

  function tabLabel(item: Tab) {
    if (item === "applicationPayments") return "Application Payments";
    if (item === "membershipApplications") return "Membership Applications";
    return item;
  }

  if (!user && loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f7f2] text-sm font-semibold text-[#315646]">Loading administration…</div>;
  }

  if (!user || !["PRESIDENT", "TREASURER", "SECRETARY"].includes(user.role)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f2] p-6">
        <div className="max-w-md rounded-3xl border border-[#dce5d9] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-[#173a2b]">Administrative access required</h1>
          <p className="mt-2 text-sm text-[#718176]">{notice?.text ?? "This workspace is available to cooperative officers."}</p>
          <Link href="/dashboard" className={`${buttonClass} mt-5 inline-block`}>Return to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <header className="border-b border-white/10 bg-[#174b36] text-white shadow-lg shadow-[#173a2b]/10">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#cfe6a5]">{user.role.toLowerCase()} workspace</p>
            <h1 className="text-lg font-black">Cooperative Administration</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-bold">
            {user.role === "SECRETARY" && <Link href="/dashboard/secretary" className="rounded-lg px-3 py-2 hover:bg-white/10">Applications</Link>}
            {user.role === "PRESIDENT" && <Link href="/dashboard/president" className="rounded-lg px-3 py-2 hover:bg-white/10">President Dashboard</Link>}
            <Link href="/dashboard" className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">Member dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item);
                setNotice(null);
                void loadTab(item);
              }}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${tab === item ? "bg-[#26633f] text-white" : "border border-[#dce5d9] bg-white text-[#496558]"}`}
            >
              {tabLabel(item)}
            </button>
          ))}
        </div>

        {notice && (
          <p aria-live="polite" className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.kind === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {notice.text}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#e1e8de] bg-white p-10 text-center text-sm text-[#718176]">Loading {tabLabel(tab)}…</div>
        ) : (
          <>
            {tab === "loans" && (
              <AdminSection title="Loan Requests" description="Review cash-loan applications and their current balances.">
                <RecordList empty="No loan requests found.">
                  {loans.map((loan) => (
                    <Record key={loan.id} title={loan.borrower.name ?? loan.borrower.username} meta={`₱${loan.amount.toLocaleString()} · ${loan.termMonths} months · ${new Date(loan.createdAt).toLocaleDateString()}`} status={loan.status}>
                      <p className="text-sm text-[#596d61]">{loan.purpose ?? "No purpose supplied."}</p>
                      {loan.rejectionReason && <p className="text-xs text-red-600">Reason: {loan.rejectionReason}</p>}
                      {loan.status === "PENDING" && (
                        <ActionRow>
                          <button disabled={busy === loan.id} onClick={() => mutate(loan.id, `/api/admin/loans/${loan.id}`, { action: "approve" }, "Loan approved and activated.")} className={buttonClass}>Approve</button>
                          <button disabled={busy === loan.id} onClick={() => {
                            const reason = rejectReason();
                            if (reason) void mutate(loan.id, `/api/admin/loans/${loan.id}`, { action: "reject", reason }, "Loan rejected.");
                          }} className={secondaryButton}>Reject</button>
                        </ActionRow>
                      )}
                    </Record>
                  ))}
                </RecordList>
              </AdminSection>
            )}

            {tab === "payments" && (
              <AdminSection title="Payment Verification" description="Review uploaded proof before applying payments to member balances.">
                <RecordList empty="No payment submissions found.">
                  {payments.map((payment) => {
                    const proofUrl = getSecureProofUrl(payment.receiptUrl);
                    const legacyReference = payment.referenceNo?.trim();
                    const hasPaymentEvidence = Boolean(proofUrl || legacyReference);
                    return (
                      <Record key={payment.id} title={payment.user.name ?? payment.user.username} meta={`₱${payment.amount.toLocaleString()} · ${payment.loan?.name ?? "Loan payment"} · ${new Date(payment.createdAt).toLocaleDateString()}`} status={payment.status}>
                        {proofUrl ? (
                          <button
                            onClick={() => setProofModalUrl(proofUrl)}
                            className="group mt-1 inline-block overflow-hidden rounded-xl border border-[#dce5d9]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofUrl}
                              alt="Proof of payment"
                              className="h-24 w-24 rounded-xl object-cover transition group-hover:opacity-80"
                            />
                          </button>
                        ) : legacyReference ? (
                          <p className="rounded-lg bg-[#f7faf5] px-3 py-2 text-xs font-semibold text-[#496558]">
                            Legacy reference: {legacyReference}
                          </p>
                        ) : (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Missing payment evidence
                          </p>
                        )}
                        {payment.rejectionReason && <p className="text-xs text-red-600">Reason: {payment.rejectionReason}</p>}
                        {payment.status === "PENDING" && (
                          <ActionRow>
                            <button disabled={busy === payment.id || !hasPaymentEvidence} onClick={() => mutate(payment.id, `/api/admin/payments/${payment.id}`, { action: "verify" }, "Payment verified.")} className={buttonClass}>Verify</button>
                            <button disabled={busy === payment.id} onClick={() => {
                              const reason = rejectReason();
                              if (reason) void mutate(payment.id, `/api/admin/payments/${payment.id}`, { action: "reject", reason }, "Payment rejected.");
                            }} className={secondaryButton}>Reject</button>
                          </ActionRow>
                        )}
                      </Record>
                    );
                  })}
                </RecordList>
              </AdminSection>
            )}

            {tab === "applicationPayments" && (
              <AdminSection title="Application Payment Approvals" description="Review application-fee proofs and record on-site payments for applicants.">
                <form
                  className="mb-5 grid gap-2 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4 sm:grid-cols-[2fr_1fr_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadTab("applicationPayments");
                  }}
                >
                  <input className={fieldClass} value={feeSearch} onChange={(e) => setFeeSearch(e.target.value)} placeholder="Search by name, application ID, username, or contact" />
                  <select className={fieldClass} value={feeStatus} onChange={(e) => setFeeStatus(e.target.value)}>
                    <option value="">All application statuses</option>
                    <option value="PENDING_PAYMENT">Pending payment</option>
                    <option value="PENDING">Pending</option>
                    <option value="PENDING_APPLICATION_REVIEW">Under review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <button disabled={loading} className={buttonClass}>Search</button>
                </form>
                {applicationsAwaitingPayment.length > 0 && (
                  <div className="mb-5 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4">
                    <p className="text-sm font-extrabold text-[#173a2b]">Record On-Site Payment</p>
                    <p className="mb-3 mt-1 text-xs text-[#718176]">Applicants who will pay at the cooperative office and have no pending proof.</p>
                    <div className="space-y-2">
                      {applicationsAwaitingPayment.map((app) => (
                        <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e3e9e0] bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-[#173a2b]">{app.fullName}</p>
                            <p className="text-xs text-[#718176]">{app.contact ?? "No contact"} · App #{app.id.slice(0, 8)} · {new Date(app.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button
                            disabled={busy === app.id}
                            onClick={() => { setOnsiteTarget(app); setOnsiteProof(null); setOnsiteRemarks(""); }}
                            className={buttonClass}
                          >
                            Mark as Paid On-Site
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <RecordList empty="No application fee payments found.">
                  {applicationFees.map((fee) => {
                    const proofUrl = getSecureProofUrl(fee.receiptUrl);
                    const isOnline = fee.paymentMethod === "ONLINE";
                    const pending = fee.status === "PENDING_APPROVAL";
                    return (
                      <Record key={fee.id} title={fee.application?.fullName ?? fee.user.name} meta={`App #${fee.application?.id.slice(0, 8) ?? "—"} · ₱${fee.amount.toLocaleString()} · ${isOnline ? "Online" : "On-site"} · ${new Date(fee.createdAt).toLocaleDateString()}`} status={fee.status}>
                        <div className="grid gap-2 text-xs">
                          <AuditRow label="Proof uploaded by" user={fee.proofUploadedBy} at={fee.proofUploadedAt} />
                          <AuditRow label="Verified by" user={fee.verifiedBy} at={fee.verifiedAt} />
                          <AuditRow label="Declined by" user={fee.declinedBy} at={fee.declinedAt} />
                        </div>
                        {proofUrl ? (
                          <button
                            onClick={() => setProofModalUrl(proofUrl)}
                            className="group mt-1 inline-block overflow-hidden rounded-xl border border-[#dce5d9]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofUrl}
                              alt="Proof of payment"
                              className="h-24 w-24 rounded-xl object-cover transition group-hover:opacity-80"
                            />
                          </button>
                        ) : fee.referenceNo ? (
                          <p className="rounded-lg bg-[#f7faf5] px-3 py-2 text-xs font-semibold text-[#496558]">
                            Reference: {fee.referenceNo}
                          </p>
                        ) : isOnline && pending ? (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Waiting for uploaded proof
                          </p>
                        ) : (
                          <p className="rounded-lg bg-[#f7faf5] px-3 py-2 text-xs font-semibold text-[#496558]">
                            Recorded on-site
                          </p>
                        )}
                        {fee.rejectionReason && <p className="text-xs text-red-600">Reason: {fee.rejectionReason}</p>}
                        {pending && (
                          <ActionRow>
                            <button disabled={busy === fee.id} onClick={() => mutate(fee.id, `/api/admin/application-payments/${fee.id}`, { action: "approve" }, "Payment approved and application advanced.")} className={buttonClass}>Approve</button>
                            <button disabled={busy === fee.id} onClick={() => {
                              const reason = window.prompt("Optional reason for declining:", "");
                              if (reason !== null) void mutate(fee.id, `/api/admin/application-payments/${fee.id}`, { action: "decline", reason: reason.trim() || undefined }, "Payment proof declined.");
                            }} className={secondaryButton}>Decline</button>
                          </ActionRow>
                        )}
                      </Record>
                    );
                  })}
                </RecordList>
              </AdminSection>
            )}

            {tab === "membershipApplications" && (
              <AdminSection
                title="Membership Applications"
                description="Review fully-paid applications and decide whether the applicant becomes a cooperative member."
              >
                <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Pending Payment Approvals"
                    value={membershipCounts.pendingPaymentApprovals}
                  />
                  <StatCard
                    label="Membership Applications"
                    value={membershipCounts.awaitingReview}
                  />
                  <StatCard label="Denied Applications" value={membershipCounts.denied} />
                  <StatCard label="Approved Members" value={membershipCounts.approvedMembers} />
                </div>

                <form
                  className="mb-5 grid gap-2 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4 sm:grid-cols-[2fr_1fr_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadTab("membershipApplications");
                  }}
                >
                  <input
                    className={fieldClass}
                    value={feeSearch}
                    onChange={(e) => setFeeSearch(e.target.value)}
                    placeholder="Search by name, application ID, or contact"
                  />
                  <select className={fieldClass} value={memFilter} onChange={(e) => setMemFilter(e.target.value)}>
                    <option value="PENDING_APPLICATION_REVIEW">Awaiting President review</option>
                    <option value="REJECTED">Denied</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING_PAYMENT">Pending payment</option>
                    <option value="">All applications</option>
                  </select>
                  <button disabled={loading} className={buttonClass}>Filter</button>
                </form>

                <RecordList empty="No membership applications found.">
                  {membershipApplications
                    .filter(
                      (app) =>
                        (!memFilter || app.status === memFilter) &&
                        (!feeSearch.trim() ||
                          app.fullName.toLowerCase().includes(feeSearch.trim().toLowerCase()) ||
                          app.id.toLowerCase().includes(feeSearch.trim().toLowerCase()) ||
                          (app.contact ?? "").toLowerCase().includes(feeSearch.trim().toLowerCase())),
                    )
                    .map((app) => {
                      const paymentOk = app.payment?.status === "APPROVED";
                      return (
                        <Record
                          key={app.id}
                          title={app.fullName}
                          meta={`App #${app.id.slice(0, 8)} · ${new Date(app.createdAt).toLocaleDateString("en-PH")} · ${app.contact ?? "No contact"}`}
                          status={app.status}
                        >
                          <div className="grid gap-2 text-xs text-[#496558]">
                            <p>
                              <span className="font-bold text-[#315646]">Payment:</span>{" "}
                              {app.payment
                                ? paymentOk
                                  ? "✓ Approved"
                                  : app.payment.status
                                : "No payment"}
                              {app.payment?.paymentMethod === "ONLINE"
                                ? " · Online"
                                : app.payment
                                  ? " · On-site"
                                  : ""}
                            </p>
                            {app.payment?.verifiedBy && (
                              <AuditRow label="Payment verified by" user={app.payment.verifiedBy} at={app.payment.verifiedAt} />
                            )}
                            <p>
                              <span className="font-bold text-[#315646]">Application status:</span>{" "}
                              {app.status === "PENDING_APPLICATION_REVIEW"
                                ? "Pending President review"
                                : app.status}
                            </p>
                            {app.status === "REJECTED" && app.rejectionReason && (
                              <p className="text-red-600">
                                <span className="font-bold">Denial reason:</span> {app.rejectionReason}
                              </p>
                            )}
                          </div>
                          <ActionRow>
                            <Link
                              href={`/admin/applications/${app.id}`}
                              className={`${buttonClass} inline-block`}
                            >
                              View Full Application
                            </Link>
                          </ActionRow>
                        </Record>
                      );
                    })}
                </RecordList>
              </AdminSection>
            )}

            {tab === "supplies" && (
              <AdminSection title="Supply Inventory" description="Maintain stock and process member requests.">
                <form
                  className="mb-5 grid gap-3 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const formElement = event.currentTarget;
                    const form = new FormData(formElement);
                    await mutate("new-supply", "/api/admin/supplies", {
                      productName: form.get("productName"),
                      price: Number(form.get("price")),
                      quantity: Number(form.get("quantity")),
                      loanLimitPerHectare: form.get("loanLimitPerHectare") ? Number(form.get("loanLimitPerHectare")) : null,
                    }, "Supply added.", "POST");
                    formElement.reset();
                  }}
                >
                  <input className={fieldClass} name="productName" required minLength={2} placeholder="Product name" />
                  <input className={fieldClass} name="price" required type="number" min="0" step="0.01" placeholder="Price" />
                  <input className={fieldClass} name="quantity" required type="number" min="0" placeholder="Stock" />
                  <input className={fieldClass} name="loanLimitPerHectare" type="number" min="0" placeholder="Loan limit per hectare (optional)" />
                  <button disabled={busy === "new-supply"} className={buttonClass}>Add item</button>
                </form>
                <RecordList empty="No inventory found.">
                  {supplies.map((supply) => (
                    <Record key={supply.id} title={supply.productName} meta={`₱${supply.price.toLocaleString()} · ${supply.quantity} in stock${supply.loanLimitPerHectare != null ? ` · limit ${supply.loanLimitPerHectare}/ha` : ""}`}>
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void mutate(supply.id, `/api/admin/supplies/${supply.id}`, {
                            productName: form.get("productName"),
                            price: Number(form.get("price")),
                            quantity: Number(form.get("quantity")),
                            loanLimitPerHectare: form.get("loanLimitPerHectare") ? Number(form.get("loanLimitPerHectare")) : null,
                          }, "Inventory updated.");
                        }}
                      >
                        <input className={`${fieldClass} min-w-44 flex-1`} name="productName" defaultValue={supply.productName} required />
                        <input aria-label="Price" className={`${fieldClass} w-28`} name="price" type="number" min="0" step="0.01" defaultValue={supply.price} required />
                        <input aria-label="Quantity" className={`${fieldClass} w-24`} name="quantity" type="number" min="0" defaultValue={supply.quantity} required />
                        <input aria-label="Loan limit per hectare" className={`${fieldClass} w-40`} name="loanLimitPerHectare" type="number" min="0" defaultValue={supply.loanLimitPerHectare ?? ""} placeholder="Limit/ha" />
                        <button disabled={busy === supply.id} className={secondaryButton}>Update</button>
                      </form>
                      {supply.transactions.filter((request) => ["PENDING", "APPROVED"].includes(request.status)).map((request) => (
                        <div key={request.id} className="mt-2 rounded-xl bg-[#f7faf5] p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span><b>{request.user.name ?? request.user.username}</b> requests {request.quantity} · {request.type}</span>
                            <Status value={request.status} />
                          </div>
                          <ActionRow>
                            {request.status === "PENDING" && <button className={buttonClass} disabled={busy === request.id} onClick={() => mutate(request.id, `/api/admin/supply-requests/${request.id}`, { action: "approve" }, "Supply request approved.")}>Approve</button>}
                            {request.status === "APPROVED" && <button className={buttonClass} disabled={busy === request.id} onClick={() => mutate(request.id, `/api/admin/supply-requests/${request.id}`, { action: "complete" }, "Supply request completed.")}>Complete</button>}
                            {request.status === "PENDING" && <button className={secondaryButton} disabled={busy === request.id} onClick={() => {
                              const reason = rejectReason();
                              if (reason) void mutate(request.id, `/api/admin/supply-requests/${request.id}`, { action: "reject", reason }, "Supply request rejected.");
                            }}>Reject</button>}
                          </ActionRow>
                        </div>
                      ))}
                    </Record>
                  ))}
                </RecordList>
              </AdminSection>
            )}

            {tab === "members" && (
              <AdminSection title="Member Records" description="Update names, roles, and account access.">
                <RecordList empty="No member records found.">
                  {members.map((member) => (
                    <Record key={member.id} title={member.name ?? member.username} meta={`@${member.username} · Joined ${new Date(member.createdAt).toLocaleDateString()}`} status={member.active ? member.role : "INACTIVE"}>
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void mutate(member.id, `/api/admin/members/${member.id}`, {
                            name: form.get("name"),
                            role: form.get("role"),
                            active: form.get("active") === "true",
                          }, "Member record updated.");
                        }}
                      >
                        <input aria-label="Member name" className={`${fieldClass} min-w-44 flex-1`} name="name" defaultValue={member.name ?? ""} required />
                        <select aria-label="Role" className={fieldClass} name="role" defaultValue={member.role}>
                          {["APPLICANT", "MEMBER", "SECRETARY", "TREASURER", "PRESIDENT"].map((role) => <option key={role}>{role}</option>)}
                        </select>
                        <select aria-label="Account status" className={fieldClass} name="active" defaultValue={String(member.active)}>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                        <button disabled={busy === member.id} className={secondaryButton}>Save</button>
                      </form>
                    </Record>
                  ))}
                </RecordList>
              </AdminSection>
            )}

            {tab === "reports" && (
              <AdminSection title="Reports" description="Generate a current snapshot for cooperative records.">
                <form
                  className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4"
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void mutate("report", "/api/admin/reports", { type: form.get("type"), title: form.get("title") || undefined }, "Report generated.", "POST");
                  }}
                >
                  <select className={fieldClass} name="type">{["SUMMARY", "MEMBERS", "LOANS", "PAYMENTS", "SUPPLIES", "MACHINES", "AUDIT"].map((type) => <option key={type}>{type}</option>)}</select>
                  <input className={`${fieldClass} min-w-56 flex-1`} name="title" placeholder="Optional report title" />
                  <button disabled={busy === "report"} className={buttonClass}>Generate report</button>
                </form>
                {reports.length > 0 ? (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setViewReport(report)}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#e3e9e0] bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <div>
                          <h3 className="font-extrabold text-[#173a2b]">{report.title}</h3>
                          <p className="text-xs text-[#718176]">{report.type} · {new Date(report.createdAt).toLocaleString()}</p>
                        </div>
                        <span className="ml-3 shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white">View</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <RecordList empty="No generated reports found.">{null}</RecordList>
                )}
              </AdminSection>
            )}

            {tab === "posts" && (
              <AdminSection title="Announcements" description="Publish cooperative notices for members.">
                <form
                  className="mb-5 grid gap-3 rounded-2xl border border-[#dce5d9] bg-[#f7faf5] p-4"
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const formElement = event.currentTarget;
                    const form = new FormData(formElement);
                    await mutate("new-post", "/api/posts", { title: form.get("title"), content: form.get("content"), published: form.get("published") === "on" }, "Announcement saved.", "POST");
                    formElement.reset();
                  }}
                >
                  <input className={fieldClass} name="title" required placeholder="Announcement title" />
                  <textarea className={`${fieldClass} min-h-24 resize-y`} name="content" placeholder="Write the announcement…" />
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#496558]"><input type="checkbox" name="published" /> Publish immediately</label>
                  <button disabled={busy === "new-post"} className={`${buttonClass} justify-self-start`}>Save announcement</button>
                </form>
                <RecordList empty="No announcements found.">
                  {posts.map((post) => (
                    <Record key={post.id} title={post.title} meta={post.content ?? "No content"} status={post.published ? "PUBLISHED" : "DRAFT"}>
                      <ActionRow>
                        <button className={secondaryButton} disabled={busy === post.id} onClick={() => mutate(post.id, `/api/posts/${post.id}`, { published: !post.published }, post.published ? "Announcement unpublished." : "Announcement published.")}>{post.published ? "Unpublish" : "Publish"}</button>
                        <button className={`${secondaryButton} text-red-600`} disabled={busy === post.id} onClick={() => {
                          if (window.confirm("Delete this announcement?")) void mutate(post.id, `/api/posts/${post.id}`, {}, "Announcement deleted.", "DELETE");
                        }}>Delete</button>
                      </ActionRow>
                    </Record>
                  ))}
                </RecordList>
              </AdminSection>
            )}
          </>
        )}
      </main>

      {proofModalUrl && (
        <ImageModal
          src={proofModalUrl}
          alt="Proof of payment"
          onClose={() => setProofModalUrl(null)}
        />
      )}

      {viewReport && (
        <ReportModal report={viewReport} onClose={() => setViewReport(null)} />
      )}

      {onsiteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => { if (!busy) setOnsiteTarget(null); }}>
          <div className="w-full max-w-md rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-[#173a2b]">Confirm On-Site Payment</h2>
            <p className="mt-1 text-sm text-[#718176]">
              You are recording that this applicant has paid the application fee in person.
            </p>
            <div className="mt-4 space-y-2 rounded-2xl bg-[#f7faf5] p-4 text-sm text-[#315646]">
              <p><b>Applicant:</b> {onsiteTarget.fullName}</p>
              <p><b>Application ID:</b> #{onsiteTarget.id}</p>
              <p><b>Application date:</b> {new Date(onsiteTarget.createdAt).toLocaleDateString("en-PH")}</p>
              <p><b>Application fee:</b> <Money value={feeAmount} /></p>
              <p><b>Payment Method:</b> On-Site</p>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-[#3d5c47]">
                Supporting proof <span className="font-normal text-[#8fa594]">(optional — photo of receipt, etc.)</span>
              </label>
              <input
                ref={onsiteInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-3 py-2 text-sm text-[#173a2b] outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf5df] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#39733e]"
                onChange={(e) => setOnsiteProof(e.target.files?.[0] ?? null)}
              />
              <input
                value={onsiteRemarks}
                onChange={(e) => setOnsiteRemarks(e.target.value)}
                placeholder="Remarks (optional)"
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-3 py-2 text-sm text-[#173a2b] outline-none placeholder:text-[#9aa89e]"
              />
              <p className="mt-2 text-xs font-semibold text-amber-700">
                On-site payments recorded without proof are clearly marked as admin-recorded on-site payments.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className={secondaryButton} disabled={busy === onsiteTarget.id} onClick={() => setOnsiteTarget(null)}>Cancel</button>
              <button className={buttonClass} disabled={busy === onsiteTarget.id} onClick={() => void recordOnsite()}>
                {busy === onsiteTarget.id ? "Recording…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#dce5d9] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black text-[#173a2b]">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-[#718176]">{description}</p>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e3e9e0] bg-[#f7faf5] px-4 py-3">
      <p className="text-xs font-semibold text-[#718176]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#173a2b]">{value}</p>
    </div>
  );
}

function RecordList({ empty, children }: { empty: string; children: React.ReactNode }) {
  const values = Array.isArray(children) ? children : [children];
  if (!values.some(Boolean)) return <p className="rounded-2xl bg-[#f7faf5] p-8 text-center text-sm text-[#718176]">{empty}</p>;
  return <div className="space-y-3">{children}</div>;
}

function Record({ title, meta, status, children }: { title: string; meta: string; status?: string; children?: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-[#e3e9e0] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-extrabold text-[#173a2b]">{title}</h3><p className="text-xs text-[#718176]">{meta}</p></div>
        {status && <Status value={status} />}
      </div>
      {children && <div className="mt-3 space-y-2">{children}</div>}
    </article>
  );
}

function Status({ value }: { value: string }) {
  const positive = ["ACTIVE", "APPROVED", "VERIFIED", "COMPLETED", "PAID", "PUBLISHED"].includes(value);
  const negative = ["REJECTED", "INACTIVE", "DECLINED", "OVERDUE"].includes(value);
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${positive ? "bg-green-100 text-green-700" : negative ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{value}</span>;
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>;
}
