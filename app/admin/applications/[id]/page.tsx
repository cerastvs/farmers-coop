"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageModal } from "@/components/ImageModal";
import { APPLICATION_DENIAL_REASONS } from "@/lib/application-fee";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Role = "APPLICANT" | "MEMBER" | "TREASURER" | "PRESIDENT" | "SECRETARY";
type AuditUser = {
  id: string;
  name: string | null;
  username: string;
  role: Role;
};

interface PaymentRecord {
  id: string;
  status: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string | null;
  receiptUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  verifiedAt: string | null;
  proofUploadedBy: AuditUser | null;
  proofUploadedAt: string | null;
  verifiedBy: AuditUser | null;
  declinedBy: AuditUser | null;
  declinedAt: string | null;
  rejectionReason: string | null;
}

interface ApplicationDetail {
  id: string;
  userId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  extensionName: string | null;
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
  reviewedBy: AuditUser | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  rejectionDetails: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user: AuditUser | null;
  metadata: Record<string, unknown> | null;
}

const ROLE_LABELS: Record<Role, string> = {
  APPLICANT: "Applicant",
  MEMBER: "Member",
  TREASURER: "Treasurer",
  PRESIDENT: "President",
  SECRETARY: "Secretary",
};

function personLabel(user: AuditUser | null) {
  if (!user) return "—";
  return `${user.name ?? user.username} — ${ROLE_LABELS[user.role] ?? user.role}`;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const fieldClass =
  "rounded-xl border border-[#dce5d9] bg-white px-3 py-2 text-sm text-[#173a2b] outline-none focus:border-[#39733e] focus:ring-2 focus:ring-[#dcefd0]";
const buttonClass =
  "rounded-xl bg-[#26633f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#174b36] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "rounded-xl border border-[#cddbc9] bg-white px-4 py-2.5 text-sm font-bold text-[#315646] transition hover:bg-[#f0f7eb] disabled:opacity-50";

export default function ApplicationReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    application: ApplicationDetail;
    payment: PaymentRecord | null;
    payments: PaymentRecord[];
    audit: AuditEntry[];
  } | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [denyDialog, setDenyDialog] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [denyExplanation, setDenyExplanation] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/membership-applications/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load application");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load application"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f2]">
        <Loader2 className="animate-spin text-[#39733e]" size={32} />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f2] p-6">
        <div className="max-w-md rounded-3xl border border-[#dce5d9] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-[#173a2b]">Application unavailable</h1>
          <p className="mt-2 text-sm text-[#718176]">
            {error ?? "Application not found."} This action is restricted to the
            President.
          </p>
          <Link href="/admin" className={`${buttonClass} mt-5 inline-block`}>
            Return to admin
          </Link>
        </div>
      </main>
    );
  }

  const { application, payment, payments, audit } = data;
  const reviewable =
    application.status === "PENDING_APPLICATION_REVIEW" ||
    application.status === "PENDING";
  const latestPayment = payment ?? payments[0];

  async function approve() {
    setBusy("approve");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/membership-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to approve application");
      setApproveDialog(false);
      setNotice({ kind: "success", text: "Membership application approved. The applicant is now a cooperative member." });
      const refreshed = await fetch(`/api/admin/membership-applications/${id}`);
      if (refreshed.ok) setData(await refreshed.json());
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy(null);
    }
  }

  async function deny() {
    const reason = denyReason.trim();
    if (!reason) return;
    const explanation = denyExplanation.trim();
    if (reason.toLowerCase() === "other" && !explanation) return;
    setBusy("deny");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/membership-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deny",
          reason,
          explanation: explanation || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to deny application");
      setDenyDialog(false);
      setDenyReason("");
      setDenyExplanation("");
      setNotice({ kind: "success", text: "Membership application denied. The applicant has been notified." });
      const refreshed = await fetch(`/api/admin/membership-applications/${id}`);
      if (refreshed.ok) setData(await refreshed.json());
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <header className="border-b border-white/10 bg-[#174b36] text-white shadow-lg shadow-[#173a2b]/10">
        <div className="mx-auto flex min-h-16 max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#cfe6a5]">
              president workspace
            </p>
            <h1 className="text-lg font-black">Membership Application Review</h1>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
          >
            <ArrowLeft size={15} /> Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {notice && (
          <p
            aria-live="polite"
            className={`mb-5 rounded-xl px-4 py-3 text-sm ${
              notice.kind === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {notice.text}
          </p>
        )}

        <div className="mb-6 rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">
                Application #{application.id.slice(0, 8)}
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#173a2b]">
                {application.fullName}
              </h2>
              <p className="mt-1 text-sm text-[#718176]">
                Submitted {new Date(application.createdAt).toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                application.status === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : application.status === "REJECTED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {application.status === "PENDING_APPLICATION_REVIEW"
                ? "Pending President review"
                : application.status}
            </span>
          </div>
        </div>

        {reviewable && (
          <div className="mb-6 flex flex-wrap gap-3 rounded-3xl border border-[#dce5d9] bg-white p-5 shadow-sm">
            <button
              className={`${buttonClass} flex-1 bg-green-700 hover:bg-green-800`}
              onClick={() => setApproveDialog(true)}
              disabled={busy !== null}
            >
              <ShieldCheck size={16} className="mr-1 inline" /> Approve Application
            </button>
            <button
              className={`${secondaryButton} flex-1 border-red-200 text-red-600 hover:bg-red-50`}
              onClick={() => setDenyDialog(true)}
              disabled={busy !== null}
            >
              <XCircle size={16} className="mr-1 inline" /> Deny Application
            </button>
          </div>
        )}

        {application.status === "APPROVED" && (
          <div className="mb-6 flex items-center gap-2 rounded-3xl border border-green-200 bg-green-50 p-5 text-green-800">
            <CheckCircle2 size={20} />
            <p className="text-sm font-bold">
              Membership approved by {personLabel(application.reviewedBy)} on{" "}
              {formatDate(application.reviewedAt)}.
            </p>
          </div>
        )}
        {application.status === "REJECTED" && (
          <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle size={20} />
              <p className="text-sm font-bold">Membership application denied</p>
            </div>
            <p className="mt-2 text-sm text-red-800">
              Decided by {personLabel(application.reviewedBy)} on{" "}
              {formatDate(application.reviewedAt)}.
            </p>
            {application.rejectionReason && (
              <p className="mt-2 text-sm font-semibold text-red-700">
                Reason: {application.rejectionReason}
              </p>
            )}
            {application.rejectionDetails && (
              <p className="mt-1 text-sm text-red-800">
                Explanation: {application.rejectionDetails}
              </p>
            )}
          </div>
        )}

        <Section title="Personal Information">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={application.fullName} />
            <Field label="Age" value={String(application.age)} />
            <Field label="Gender" value={application.gender} />
            <Field label="Contact number" value={application.contact} />
            <div className="sm:col-span-2">
              <Field label="Address" value={application.address} />
            </div>
          </dl>
        </Section>

        <Section title="Cooperative Information">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Field label="Farm size" value={`${application.farmSize} hectares`} />
            <Field label="Crop type" value={application.cropType} />
            <Field label="Years farming" value={`${application.yearsFarming} years`} />
          </dl>
        </Section>

        <Section title="Uploaded Documents">
          <div className="grid gap-3 sm:grid-cols-2">
            <DocumentCard
              label="Valid ID"
              src={application.validIdUrl}
              onOpen={() =>
                setImageModal({ src: application.validIdUrl, alt: "Valid ID" })
              }
            />
            <DocumentCard
              label="Proof of Farm"
              src={application.proofOfFarmUrl}
              onOpen={() =>
                setImageModal({ src: application.proofOfFarmUrl, alt: "Proof of Farm" })
              }
            />
          </div>
        </Section>

        <Section title="Payment Information">
          {latestPayment ? (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field
                  label="Application fee"
                  value={`₱${latestPayment.amount.toLocaleString()}`}
                />
                <Field
                  label="Payment method"
                  value={latestPayment.paymentMethod === "ON_SITE" ? "On-Site" : "Online"}
                />
                <Field label="Payment status" value={latestPayment.status} />
                <Field label="Payment date" value={formatDate(latestPayment.paidAt ?? latestPayment.createdAt)} />
                {latestPayment.referenceNo && (
                  <Field label="Reference" value={latestPayment.referenceNo} />
                )}
                <Field label="Proof uploaded by" value={personLabel(latestPayment.proofUploadedBy)} />
                <Field label="Verified by" value={personLabel(latestPayment.verifiedBy)} />
              </dl>
              {latestPayment.verifiedAt && (
                <p className="mt-3 text-xs text-[#718176]">
                  Payment verified on {formatDate(latestPayment.verifiedAt)}.
                </p>
              )}
              {getSecureProofUrl(latestPayment.receiptUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    setImageModal({
                      src: getSecureProofUrl(latestPayment.receiptUrl)!,
                      alt: "Payment proof",
                    })
                  }
                  className="mt-4 group inline-block overflow-hidden rounded-xl border border-[#dce5d9]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSecureProofUrl(latestPayment.receiptUrl)!}
                    alt="Payment proof"
                    className="h-28 w-28 rounded-xl object-cover transition group-hover:opacity-80"
                  />
                </button>
              )}
              {latestPayment.rejectionReason && (
                <p className="mt-3 text-xs text-red-600">
                  Payment declined: {latestPayment.rejectionReason}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#718176]">No application fee payment recorded.</p>
          )}
        </Section>

        <Section title="Application History / Audit Trail">
          {audit.length === 0 ? (
            <p className="text-sm text-[#718176]">No recorded activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-[#e3eae0] bg-[#fafdf7] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#173a2b]">
                      {formatAction(entry.action)}
                    </p>
                    <p className="text-xs text-[#8fa594]">{formatDate(entry.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#496558]">
                    By: {personLabel(entry.user)}
                  </p>
                  {entry.action === "MEMBERSHIP_APPLICATION_REJECTED" &&
                    Boolean(entry.metadata?.rejectionReason) && (
                      <p className="mt-1 text-xs text-red-600">
                        Reason: {String(entry.metadata?.rejectionReason)}
                      </p>
                    )}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </main>

      {imageModal && (
        <ImageModal
          src={imageModal.src}
          alt={imageModal.alt}
          onClose={() => setImageModal(null)}
        />
      )}

      {approveDialog && (
        <Dialog onClose={() => !busy && setApproveDialog(false)}>
          <h2 className="text-lg font-black text-[#173a2b]">Approve Membership Application?</h2>
          <p className="mt-2 text-sm text-[#718176]">
            You are approving {application.fullName}&apos;s membership application. Once
            approved, the applicant will become an official cooperative member.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className={secondaryButton} disabled={busy !== null} onClick={() => setApproveDialog(false)}>
              Cancel
            </button>
            <button
              className={`${buttonClass} bg-green-700 hover:bg-green-800`}
              disabled={busy !== null}
              onClick={() => void approve()}
            >
              {busy === "approve" ? "Approving…" : "Confirm Approval"}
            </button>
          </div>
        </Dialog>
      )}

      {denyDialog && (
        <Dialog onClose={() => !busy && setDenyDialog(false)}>
          <h2 className="text-lg font-black text-[#173a2b]">Deny Membership Application</h2>
          <p className="mt-2 text-sm text-[#718176]">
            Please provide the reason for denying this application. The applicant will
            be notified.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#3d5c47]">
                Reason
              </label>
              <select
                className={fieldClass}
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                {APPLICATION_DENIAL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#3d5c47]">
                Explanation <span className="font-normal normal-case text-[#8fa594]">(required if reason is &quot;Other&quot;)</span>
              </label>
              <textarea
                className={`${fieldClass} min-h-24 w-full resize-y`}
                value={denyExplanation}
                onChange={(e) => setDenyExplanation(e.target.value)}
                placeholder="Detailed explanation for the applicant…"
                maxLength={1000}
              />
            </div>
            {denyReason.toLowerCase() === "other" && !denyExplanation.trim() && (
              <p className="text-xs font-semibold text-red-600">
                An explanation is required when the reason is &quot;Other&quot;.
              </p>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className={secondaryButton} disabled={busy !== null} onClick={() => setDenyDialog(false)}>
              Cancel
            </button>
            <button
              className={`${buttonClass} bg-red-600 hover:bg-red-700`}
              disabled={busy !== null || !denyReason.trim() || (denyReason.toLowerCase() === "other" && !denyExplanation.trim())}
              onClick={() => void deny()}
            >
              {busy === "deny" ? "Denying…" : "Deny Application"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-[#173a2b]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[#8fa594]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-[#173a2b]">{value || "—"}</dd>
    </div>
  );
}

function DocumentCard({
  label,
  src,
  onOpen,
}: {
  label: string;
  src: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-xl border border-[#eef2e8] bg-[#fafdf7] px-4 py-3 text-left transition hover:border-green-300 hover:bg-green-50/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="h-16 w-16 rounded-lg object-cover transition group-hover:opacity-80"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#173a2b]">{label}</p>
        <p className="text-[11px] text-[#718176]">Click to enlarge</p>
      </div>
    </button>
  );
}

function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    APPLICATION_FEE_PROOF_SUBMITTED: "Payment proof submitted",
    APPLICATION_FEE_APPROVED: "Payment approved",
    APPLICATION_FEE_APPLICATION_READY: "Application advanced for review",
    MEMBERSHIP_APPLICATION_APPROVED: "Application approved",
    MEMBERSHIP_APPLICATION_REJECTED: "Application denied",
    APPLICATION_FEE_PAYMENT_RECORDED_ONSITE: "On-site payment recorded",
  };
  return labels[action] ?? action;
}