"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardHeader } from "../components/DashboardHeader";
import { MembershipProgressSteps } from "@/components/MembershipProgressSteps";
import { Money } from "@/components/Money";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileImage,
  Loader2,
  MapPin,
  QrCode,
  Upload,
  XCircle,
} from "lucide-react";

type ApplicationFeeStatus =
  | "none"
  | "pending"
  | "approved"
  | "declined"
  | "rejected";

interface AuditUser {
  id: string;
  name: string | null;
  username: string;
  role: string;
}

interface PaymentRecord {
  id: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "DECLINED";
  amount: number;
  paymentMethod: "ONLINE" | "ON_SITE";
  referenceNo: string | null;
  receiptUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  proofUploadedBy: AuditUser | null;
  proofUploadedAt: string | null;
  verifiedBy: AuditUser | null;
  declinedBy: AuditUser | null;
  declinedAt: string | null;
}

interface ApplicationFeeData {
  application: {
    id: string;
    status: string;
    rejectionReason: string | null;
    rejectionDetails: string | null;
    reviewedAt: string | null;
    reviewedBy: AuditUser | null;
  };
  fee: { amount: number };
  payment: PaymentRecord | null;
  history: PaymentRecord[];
}

export default function PaymentPage() {
  const [data, setData] = useState<ApplicationFeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/application-fee");
      if (res.status === 404) {
        setError("No membership application found for your account.");
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load payment status");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f2]">
        <DashboardHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[#718176]">
          <Loader2 className="mx-auto mb-3 animate-spin text-[#39733e]" size={28} />
          Loading payment status…
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f7f7f2]">
        <DashboardHeader />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-3xl border border-[#dce5d9] bg-white p-10 text-center">
            <XCircle className="mx-auto mb-4 text-red-500" size={40} />
            <h1 className="text-xl font-black text-[#173a2b]">Payment unavailable</h1>
            <p className="mt-2 text-sm text-[#718176]">{error}</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-xl bg-[#26633f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#174b36]"
            >
              Return to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { application } = data;
  const phase = derivePhase(application.status, data.payment);

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4f7e38] transition hover:text-[#2d6a2d]"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4f7e38]">
            Membership application
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#173a2b]">
            Application Fee Payment
          </h1>
          <p className="mt-1 text-sm text-[#718176]">
            Your application was submitted successfully. Please pay the application fee to continue with your membership application.
          </p>
        </div>

        <MembershipProgressSteps currentIndex={currentStepIndex(application.status, phase)} />

        {phase === "none" && <WaitingForPayment data={data} onSubmitted={load} />}
        {phase === "pending" && <PendingApproval data={data} />}
        {phase === "approved" && <PaymentApproved data={data} />}
        {phase === "declined" && (
          <DeclinedProof data={data} onResubmit={load} />
        )}
        {phase === "rejected" && <ApplicationRejected data={data} />}

        {data.history.length > 0 && (
          <PaymentHistoryCard history={data.history} />
        )}
      </main>
    </div>
  );
}

function derivePhase(
  applicationStatus: string,
  payment: PaymentRecord | null,
): ApplicationFeeStatus {
  if (applicationStatus === "REJECTED") return "rejected";
  if (applicationStatus === "APPROVED") return "approved";
  if (!payment) return "none";
  if (payment.status === "PENDING_APPROVAL") return "pending";
  if (payment.status === "APPROVED") return "approved";
  return "declined";
}

function currentStepIndex(applicationStatus: string, phase: ApplicationFeeStatus) {
  if (applicationStatus === "APPROVED") return 4;
  if (applicationStatus === "REJECTED") return 3;
  if (phase === "approved") return 3;
  if (phase === "pending") return 2;
  return 1;
}

function WaitingForPayment({
  data,
  onSubmitted,
}: {
  data: ApplicationFeeData;
  onSubmitted: () => void;
}) {
  return (
    <>
      <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 text-amber-800">
          <Clock size={18} />
          <h2 className="font-extrabold">Waiting for Payment</h2>
        </div>
        <p className="mt-2 text-sm text-amber-800/90">
          Submit your application fee to continue. Your application will only be
          reviewed once the payment is verified.
        </p>
      </div>

      <PaymentDetailsCard data={data} onSubmitted={onSubmitted} />
    </>
  );
}

function PaymentDetailsCard({
  data,
  onSubmitted,
}: {
  data: ApplicationFeeData;
  onSubmitted: () => void;
}) {
  const { fee } = data;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">
              Application fee
            </p>
            <p className="mt-1 text-3xl font-black text-[#173a2b]">
              <Money value={fee.amount} />
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#edf5df] px-3 py-2 text-sm font-bold text-[#39733e]">
            <QrCode size={18} />
            Pay once
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e3eae0] bg-[#fafdf7] p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#4f7e38]">
              Option 1 — Pay digitally
            </p>
            <div className="mx-auto mb-4 grid w-44 place-items-center rounded-2xl border border-[#dce5d9] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/payment-qr.svg"
                alt="QR code for application fee payment"
                className="h-36 w-36"
              />
            </div>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-[#315646]">
              <li>Scan the QR code with your e-wallet or bank app.</li>
              <li>Enter the exact amount of <Money value={fee.amount} />.</li>
              <li>Use your full name as the payment reference.</li>
              <li>Save the confirmation, then upload it as your proof.</li>
            </ol>
            <p className="mt-3 rounded-xl bg-[#edf5df] px-3 py-2 text-xs font-semibold text-[#39733e]">
              We never ask for your PIN, password, or banking credentials.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3eae0] bg-[#fafdf7] p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#4f7e38]">
              Option 2 — Pay on-site
            </p>
            <div className="flex items-start gap-2 text-sm text-[#315646]">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#4f7e38]" />
              <p>
                You may also pay the application fee directly at the cooperative
                office. Our staff will record your on-site payment — no upload
                needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      <UploadProofForm onSubmitted={onSubmitted} />
    </div>
  );
}

function UploadProofForm({
  onSubmitted,
  declinedReason,
}: {
  onSubmitted: () => void;
  declinedReason?: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [referenceNo, setReferenceNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Please attach a screenshot or receipt as proof of payment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("paymentMethod", "ONLINE");
      if (referenceNo.trim()) formData.set("referenceNo", referenceNo.trim());
      formData.set("proofOfPayment", file);
      const res = await fetch("/api/application-fee", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to submit payment proof.");
        return;
      }
      setFile(null);
      setReferenceNo("");
      if (inputRef.current) inputRef.current.value = "";
      onSubmitted();
    } catch {
      setError("Something went wrong while submitting your payment proof.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm"
    >
      {declinedReason && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">
            Previous proof was declined
          </p>
          <p className="mt-1 text-sm text-red-800">
            {declinedReason || "No reason was provided."}
          </p>
          <p className="mt-2 text-sm font-semibold text-red-700">
            Please upload a new, clearer proof of payment.
          </p>
        </div>
      )}

      <h2 className="text-lg font-extrabold text-[#173a2b]">
        Submit Payment Proof
      </h2>
      <p className="mt-1 text-sm text-[#718176]">
        Upload your receipt or screenshot so the President can verify your
        payment.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#3d5c47]">
            Payment reference <span className="font-normal text-[#8fa594]">(optional)</span>
          </label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="e.g. GCash reference 1234 5678"
            maxLength={100}
            className="w-full rounded-xl border border-[#dbe5d7] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#173a2b] outline-none transition placeholder:text-[#9aa89e] focus:border-[#4f7e38] focus:ring-4 focus:ring-[#b9db9e]/35"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#3d5c47]">
            Proof of payment
          </label>
          <div
            className={`flex items-center gap-3 rounded-xl border bg-[#fafcf8] px-4 py-3 transition focus-within:border-[#4f7e38] focus-within:ring-4 focus-within:ring-[#b9db9e]/35 ${
              error ? "border-red-400" : "border-[#dbe5d7]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id="proofOfPayment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="proofOfPayment"
              className="flex cursor-pointer items-center gap-2 text-sm text-[#5b6e62] transition hover:text-[#174b36]"
            >
              <FileImage size={18} className="text-[#8fa594]" />
              {file ? <span className="font-semibold text-[#173a2b]">{file.name}</span> : <span>Choose file</span>}
            </label>
            <span className="ml-auto text-xs text-[#b5c4b9]">
              JPEG · PNG · WebP · max 5 MB
            </span>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#174b36] px-5 py-3 font-bold text-white shadow-lg shadow-[#174b36]/15 transition hover:bg-[#0e3b2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {busy ? "Submitting…" : "Submit Payment Proof"}
        </button>
      </div>
    </form>
  );
}

function PendingApproval({ data }: { data: ApplicationFeeData }) {
  const latest = data.history[0];
  return (
    <div className="mb-6 rounded-3xl border border-orange-200 bg-orange-50 p-6">
      <div className="flex items-center gap-2 text-orange-700">
        <Clock size={18} />
        <h2 className="font-extrabold">Payment Proof Submitted</h2>
      </div>
      <p className="mt-2 text-sm text-orange-800/90">
        Your payment proof has been submitted successfully. Please wait while
        the President verifies your payment.
      </p>
      {latest && (
        <p className="mt-3 text-xs font-semibold text-orange-700">
          Submitted {formatDate(latest.createdAt)} ·{" "}
          <Money value={latest.amount} />
          {latest.referenceNo ? ` · Ref ${latest.referenceNo}` : ""}
        </p>
      )}
      <div className="mt-4 rounded-2xl border border-orange-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
          You will not be able to submit another proof until this one is reviewed.
        </p>
      </div>
    </div>
  );
}

function PaymentApproved({ data }: { data: ApplicationFeeData }) {
  const latest = data.history[0];
  const inReview = data.application.status === "PENDING_APPLICATION_REVIEW";
  return (
    <>
      <div className="mb-6 rounded-3xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 size={18} />
          <h2 className="font-extrabold">Payment Approved</h2>
        </div>
        <p className="mt-2 text-sm text-green-800/90">
          {inReview
            ? "Your application fee payment has been verified. Your application will now proceed to the next stage."
            : "Your application fee payment has been verified successfully."}
        </p>
        {latest?.verifiedAt && (
          <p className="mt-3 text-xs font-semibold text-green-700">
            Verified {formatDate(latest.verifiedAt)}
          </p>
        )}
      </div>
      {latest && (
        <div className="mb-6 rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#173a2b]">Payment Details</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Payment method</dt>
              <dd className="mt-0.5 font-semibold text-[#173a2b]">{latest.paymentMethod === "ON_SITE" ? "On-Site" : "Online"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Status</dt>
              <dd className="mt-0.5 font-semibold text-green-700">Approved</dd>
            </div>
            {latest.referenceNo && (
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Reference</dt>
                <dd className="mt-0.5 font-semibold text-[#173a2b]">{latest.referenceNo}</dd>
              </div>
            )}
            {latest.receiptUrl && (
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Proof</dt>
                <dd className="mt-0.5 break-all font-semibold text-[#4f7e38]">{latest.receiptUrl}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Uploaded by</dt>
              <dd className="mt-0.5 font-semibold text-[#173a2b]">
                {personLabel(latest.proofUploadedBy) ?? "—"}
                {latest.proofUploadedAt ? <span className="block text-xs font-normal text-[#8fa594]">{formatDate(latest.proofUploadedAt)}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[#8fa594]">Verified by</dt>
              <dd className="mt-0.5 font-semibold text-[#173a2b]">
                {personLabel(latest.verifiedBy) ?? "—"}
                {latest.verifiedAt ? <span className="block text-xs font-normal text-[#8fa594]">{formatDate(latest.verifiedAt)}</span> : null}
              </dd>
            </div>
          </dl>
        </div>
      )}
      {inReview && (
        <div className="mb-6 rounded-3xl border border-[#dce5d9] bg-white p-6">
          <h2 className="text-lg font-extrabold text-[#173a2b]">
            Application Under Review
          </h2>
          <p className="mt-1 text-sm text-[#718176]">
            Your application is now being reviewed by the cooperative. We will
            notify you once your membership has been approved.
          </p>
        </div>
      )}
    </>
  );
}

function DeclinedProof({
  data,
  onResubmit,
}: {
  data: ApplicationFeeData;
  onResubmit: () => void;
}) {
  const latest = data.history[0];
  return (
    <>
      <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <XCircle size={18} />
          <h2 className="font-extrabold">Payment Proof Declined</h2>
        </div>
        <p className="mt-2 text-sm text-red-800">
          Your submitted payment proof could not be approved.
        </p>
        <div className="mt-3 rounded-2xl border border-red-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">
            Reason
          </p>
          <p className="mt-1 text-sm text-red-800">
            {latest?.rejectionReason || "No reason was provided."}
          </p>
        </div>
        <p className="mt-3 text-sm font-semibold text-red-700">
          Please submit a new payment proof below.
        </p>
      </div>
      <UploadProofForm onSubmitted={onResubmit} declinedReason={latest?.rejectionReason} />
    </>
  );
}

function ApplicationRejected({ data }: { data: ApplicationFeeData }) {
  const { application } = data;
  return (
    <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-center gap-2 text-red-600">
        <XCircle size={18} />
        <h2 className="font-extrabold">Membership Application Denied</h2>
      </div>
      <p className="mt-2 text-sm text-red-800">
        Unfortunately, your membership application was not approved. This
        decision concerns your application — your approved payment remains
        valid and separate.
      </p>
      <div className="mt-4 space-y-4 rounded-2xl border border-red-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">
              Application status
            </p>
            <p className="mt-1 text-sm font-semibold text-red-700">Denied</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4f7e38]">
              Payment status
            </p>
            <p className="mt-1 text-sm font-semibold text-green-700">Approved</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">
            Reason
          </p>
          <p className="mt-1 text-sm font-semibold text-red-800">
            {application.rejectionReason || "No reason was provided."}
          </p>
        </div>
        {application.rejectionDetails && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">
              Message from the President
            </p>
            <p className="mt-1 text-sm text-red-800">
              {application.rejectionDetails}
            </p>
          </div>
        )}
        {application.reviewedBy && (
          <p className="text-xs text-[#718176]">
            Decided by: {personLabel(application.reviewedBy)} ·{" "}
            {formatDate(application.reviewedAt)}
          </p>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-red-700">
        You do not need to pay the application fee again.
      </p>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  APPLICANT: "Applicant",
  MEMBER: "Member",
  TREASURER: "Treasurer",
  PRESIDENT: "President",
  SECRETARY: "Secretary",
};

function personLabel(user: AuditUser | null) {
  if (!user) return null;
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

function PaymentHistoryCard({ history }: { history: PaymentRecord[] }) {
  if (history.length === 0) return null;
  return (
    <div className="rounded-3xl border border-[#dce5d9] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold text-[#173a2b]">Payment History & Audit Trail</h2>
      <p className="mt-1 text-sm text-[#718176]">
        Every payment proof submission and decision for this application, with
        the person who uploaded and reviewed it.
      </p>
      <div className="mt-4 space-y-2">
        {history.map((record) => (
          <div
            key={record.id}
            className="rounded-xl border border-[#e3eae0] bg-[#fafdf7] px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#173a2b]">
                  <Money value={record.amount} />
                  <span className="ml-2 text-xs font-semibold text-[#718176]">
                    {record.paymentMethod === "ON_SITE" ? "On-site" : "Online"}
                  </span>
                </p>
                <p className="text-xs text-[#8fa594]">
                  {formatDate(record.createdAt)}
                  {record.referenceNo ? ` · ${record.referenceNo}` : ""}
                </p>
              </div>
              <StatusPill status={record.status} />
            </div>
            <div className="mt-2 space-y-1 border-t border-[#e3eae0] pt-2 text-xs text-[#496558]">
              {record.proofUploadedBy && (
                <p>
                  <span className="font-bold text-[#315646]">Proof uploaded by:</span>{" "}
                  {personLabel(record.proofUploadedBy)}
                  <span className="text-[#8fa594]"> · {formatDate(record.proofUploadedAt)}</span>
                </p>
              )}
              {record.verifiedBy && (
                <p>
                  <span className="font-bold text-[#315646]">Payment verified by:</span>{" "}
                  {personLabel(record.verifiedBy)}
                  <span className="text-[#8fa594]"> · {formatDate(record.verifiedAt)}</span>
                </p>
              )}
              {record.declinedBy && (
                <p>
                  <span className="font-bold text-[#315646]">Payment declined by:</span>{" "}
                  {personLabel(record.declinedBy)}
                  <span className="text-[#8fa594]"> · {formatDate(record.declinedAt)}</span>
                </p>
              )}
              {record.rejectionReason && (
                <p className="text-red-600">
                  <span className="font-bold">Reason:</span> {record.rejectionReason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PaymentRecord["status"] }) {
  const styles: Record<PaymentRecord["status"], string> = {
    PENDING_APPROVAL: "bg-orange-100 text-orange-700",
    APPROVED: "bg-green-100 text-green-700",
    DECLINED: "bg-red-100 text-red-600",
  };
  const labels: Record<PaymentRecord["status"], string> = {
    PENDING_APPROVAL: "🟠 Waiting for approval",
    APPROVED: "🟢 Approved",
    DECLINED: "🔴 Declined",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
