"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Loader2,
  Package,
  PenLine,
  Search,
  Tractor,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

type MemberApplication = {
  fullName: string;
  age: number;
  gender: string;
  address: string;
  contact: string;
  farmSize: number;
  cropType: string;
  yearsFarming: number;
} | null;

type LoanInfo = {
  id: string;
  name: string;
  type: string;
  amount: number;
  remainingBalance: number;
  status: string;
  due: string | null;
  createdAt: string | null;
};

type MachineRequestInfo = {
  id: string;
  machineName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type SupplyTransactionInfo = {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  type: string;
  status: string;
};

type PaymentInfo = {
  id: string;
  amount: number;
  type: string;
  status: string;
  loanName: string | null;
  createdAt: string | null;
};

type MemberSummary = {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
  joined: string | null;
  application: MemberApplication;
  loans: LoanInfo[];
  activeLoan: LoanInfo | null;
  machineRequests: MachineRequestInfo[];
  supplyTransactions: SupplyTransactionInfo[];
  payments: PaymentInfo[];
};

type MachineCatalog = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

type SupplyCatalog = {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  loanLimitPerHectare: number | null;
};

type ActionKind = "loan" | "machine" | "supply" | "payment" | "profile";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  PAID: "bg-gray-100 text-gray-500",
  REJECTED: "bg-red-100 text-red-600",
  COMPLETED: "bg-green-100 text-green-700",
  IN_USE: "bg-indigo-100 text-indigo-700",
  OVERDUE: "bg-red-100 text-red-600",
  RETURNED: "bg-gray-100 text-gray-600",
  QUEUED: "bg-yellow-100 text-yellow-700",
  RETURN_PENDING: "bg-purple-100 text-purple-700",
};

const ACTION_META: Record<
  ActionKind,
  { label: string; description: string; icon: React.ComponentType<{ size?: number }>; accent: string }
> = {
  loan: {
    label: "Record Loan",
    description: "Open a new loan account for the member",
    icon: Banknote,
    accent: "border-l-green-400",
  },
  machine: {
    label: "Reserve Machine",
    description: "Book farm equipment for the member",
    icon: Tractor,
    accent: "border-l-blue-400",
  },
  supply: {
    label: "Record Supply",
    description: "Sell or loan out supplies from inventory",
    icon: Package,
    accent: "border-l-orange-400",
  },
  payment: {
    label: "Record Payment",
    description: "Accept a cash payment at the office",
    icon: Wallet,
    accent: "border-l-emerald-400",
  },
  profile: {
    label: "Edit Profile",
    description: "Update the member record in the office",
    icon: PenLine,
    accent: "border-l-purple-400",
  },
};

const inputClass =
  "w-full rounded-lg border border-[#e2ebe6] bg-[#fafdf9] px-3.5 py-2.5 text-sm text-[#0f2318] outline-none transition focus:border-[#1b5e3b] focus:ring-2 focus:ring-[#1b5e3b]/15";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#5a7267]";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || "Request failed");
  return result;
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || "Request failed");
  return result;
}

const ACCEPTED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;

function validateProofFile(file: File | undefined): string | null {
  if (!file || file.size === 0) return "Choose a proof-of-payment image.";
  if (!ACCEPTED_PROOF_TYPES.has(file.type)) return "Use a JPEG, PNG, or WebP image.";
  if (file.size > MAX_PROOF_SIZE_BYTES) return "The proof image must be 5 MB or smaller.";
  return null;
}

function ContextFields({
  value,
  onChange,
}: {
  value: { source: string; remarks: string; reason: string };
  onChange: (next: { source: string; remarks: string; reason: string }) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Entry point</label>
        <select
          className={inputClass}
          value={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.value })}
        >
          <option value="OFFICE">Office (counter)</option>
          <option value="WALK_IN">Walk-in / Field</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Remarks (optional)</label>
        <input
          className={inputClass}
          value={value.remarks}
          placeholder="Visible on the member record"
          onChange={(e) => onChange({ ...value, remarks: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Reason (audit trail)</label>
        <input
          className={inputClass}
          value={value.reason}
          placeholder="Why this manual entry is being recorded"
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
        />
      </div>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  icon: Icon,
  busy,
  error,
  onClose,
  onSubmit,
  children,
  submitLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        <div className="flex items-start justify-between border-b border-[#e2ebe6] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0f7eb] text-[#1b5e3b]">
              <Icon size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#0f2318]">{title}</h3>
              <p className="text-[11px] text-[#5a7267]">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-[#5a7267] transition hover:bg-gray-100 disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <form
          className="space-y-4 overflow-y-auto px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
              <AlertTriangle size={14} className="shrink-0" />{error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1b5e3b] py-3 text-sm font-bold text-white transition-all hover:bg-[#15503a] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Recording…" : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoanModal({
  member,
  disabled,
  onClose,
  onSuccess,
}: {
  member: MemberSummary;
  disabled: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("6");
  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState("MONEY");
  const [context, setContext] = useState({ source: "OFFICE", remarks: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin-actions/loan", {
        memberId: member.id,
        amount: Number(amount),
        termMonths: Number(termMonths),
        purpose,
        type,
        source: context.source,
        remarks: context.remarks || undefined,
        reason: context.reason || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record loan");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Record Loan"
      subtitle={`New loan account for ${member.name}`}
      icon={Banknote}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Record Loan"
    >
      {disabled && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          Member already has a pending, approved, or active loan. Release the existing account before opening a new one.
        </div>
      )}
      <div>
        <label className={labelClass}>Loan type</label>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="MONEY">Cash loan</option>
          <option value="SUPPLY">Supply loan</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Amount (₱)</label>
          <input
            className={inputClass}
            type="number"
            min="0.01"
            max="5000"
            step="0.01"
            required
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Term (months)</label>
          <select className={inputClass} value={termMonths} onChange={(e) => setTermMonths(e.target.value)}>
            {[6, 8, 10, 12, 18, 24].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Purpose</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          required
          minLength={10}
          value={purpose}
          placeholder="Farm inputs, equipment, seeds, etc."
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>
      <ContextFields value={context} onChange={setContext} />
    </ModalShell>
  );
}

function MachineModal({
  member,
  machines,
  onClose,
  onSuccess,
}: {
  member: MemberSummary;
  machines: MachineCatalog[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [context, setContext] = useState({ source: "OFFICE", remarks: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin-actions/machine", {
        memberId: member.id,
        machineId,
        startDate,
        endDate,
        source: context.source,
        remarks: context.remarks || undefined,
        reason: context.reason || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve machine");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Reserve Machine"
      subtitle={`Book equipment for ${member.name}`}
      icon={Tractor}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Reserve Machine"
    >
      <div>
        <label className={labelClass}>Machine</label>
        <select className={inputClass} value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Start date</label>
          <input className={inputClass} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input className={inputClass} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <ContextFields value={context} onChange={setContext} />
    </ModalShell>
  );
}

function SupplyModal({
  member,
  supplies,
  onClose,
  onSuccess,
}: {
  member: MemberSummary;
  supplies: SupplyCatalog[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supplyId, setSupplyId] = useState(supplies[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [type, setType] = useState("PURCHASE");
  const [context, setContext] = useState({ source: "OFFICE", remarks: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = supplies.find((s) => s.id === supplyId);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin-actions/supply", {
        memberId: member.id,
        supplyId,
        quantity: Number(quantity),
        type,
        source: context.source,
        remarks: context.remarks || undefined,
        reason: context.reason || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record supply");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Record Supply"
      subtitle={`Supply transaction for ${member.name}`}
      icon={Package}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Record Supply"
    >
      <div>
        <label className={labelClass}>Item</label>
        <select className={inputClass} value={supplyId} onChange={(e) => setSupplyId(e.target.value)} required>
          {supplies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.productName} — ₱{s.price.toLocaleString()} · stock {s.quantity}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1.5 text-[11px] text-[#5a7267]">
            {selected.loanLimitPerHectare
              ? `Loanable up to ${selected.loanLimitPerHectare} unit${selected.loanLimitPerHectare > 1 ? "s" : ""} per hectare.`
              : "Cash purchase only (no per-hectare loan limit)."}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <input className={inputClass} type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PURCHASE">Purchase</option>
            <option value="LOAN">Loan (farm inputs)</option>
          </select>
        </div>
      </div>
      {selected && Number(quantity) > 0 && (
        <p className="rounded-lg bg-[#f0f7eb] px-3.5 py-2 text-xs font-semibold text-[#1b5e3b]">
          Total: ₱{(selected.price * Number(quantity)).toLocaleString()}
        </p>
      )}
      <ContextFields value={context} onChange={setContext} />
    </ModalShell>
  );
}

function PaymentModal({
  member,
  onClose,
  onSuccess,
}: {
  member: MemberSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const activeLoans = member.loans.filter((l) => l.status === "ACTIVE");

  const [type, setType] = useState("LOAN_PAYMENT");
  const [loanId, setLoanId] = useState(activeLoans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [context, setContext] = useState({ source: "OFFICE", remarks: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoanPayment = type === "LOAN_PAYMENT";

  function handleProofChange(file: File | undefined) {
    const validation = validateProofFile(file);
    if (validation) {
      setError(validation);
      setProofFile(null);
      setProofPreview(null);
      return;
    }
    setError(null);
    setProofFile(file ?? null);
    if (file) setProofPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (isLoanPayment && !proofFile) {
      setError("Choose a proof-of-payment image.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("memberId", member.id);
      form.set("type", type);
      if (isLoanPayment && loanId) form.set("loanId", loanId);
      form.set("amount", amount);
      form.set("source", context.source);
      if (context.remarks) form.set("remarks", context.remarks);
      if (context.reason) form.set("reason", context.reason);
      if (proofFile) form.set("proofOfPayment", proofFile);

      const res = await fetch("/api/admin-actions/payment", {
        method: "POST",
        body: form,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Request failed");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Record Payment"
      subtitle={`Cash payment accepted for ${member.name}`}
      icon={Wallet}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Record Payment"
    >
      <div>
        <label className={labelClass}>Payment type</label>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="LOAN_PAYMENT">Loan payment</option>
          <option value="MEMBERSHIP_FEE">Membership fee</option>
          <option value="EQUIPMENT_PURCHASE">Equipment purchase</option>
          <option value="OTHER_FEE">Other fee</option>
        </select>
      </div>
      {isLoanPayment && (
        <div>
          <label className={labelClass}>Loan account</label>
          {activeLoans.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <AlertTriangle size={14} className="shrink-0" />Member has no active loan.
            </p>
          ) : (
            <select className={inputClass} value={loanId} onChange={(e) => setLoanId(e.target.value)} required>
              {activeLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — ₱{l.remainingBalance.toLocaleString()} remaining
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div>
        <label className={labelClass}>Amount (₱)</label>
        <input
          className={inputClass}
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          placeholder="0.00"
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>
          Proof of payment {isLoanPayment ? "(required)" : "(optional)"}
        </label>
        <input
          className="block w-full rounded-lg border border-[#e2ebe6] bg-[#fafdf9] px-3 py-2 text-sm text-[#0f2318] outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-[#f0f7eb] file:px-3 file:py-1.5 file:font-semibold file:text-[#1b5e3b]"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleProofChange(e.target.files?.[0])}
        />
        {proofPreview && (
          <div className="mt-2">
            <img
              src={proofPreview}
              alt="Proof of payment preview"
              className="h-24 w-24 rounded-lg border border-[#e2ebe6] object-cover"
            />
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-[#5a7267]">
          JPEG, PNG, or WebP. Maximum file size: 5 MB. Clear photo of the bank, e-wallet, or office receipt.
        </p>
      </div>
      <ContextFields value={context} onChange={setContext} />
    </ModalShell>
  );
}

function ProfileModal({
  member,
  onClose,
  onSuccess,
}: {
  member: MemberSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const app = member.application;
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const [fullName, setFullName] = useState(app?.fullName ?? "");
  const [age, setAge] = useState(app ? String(app.age) : "");
  const [gender, setGender] = useState(app?.gender ?? "Male");
  const [address, setAddress] = useState(app?.address ?? "");
  const [contact, setContact] = useState(app?.contact ?? "");
  const [farmSize, setFarmSize] = useState(app ? String(app.farmSize) : "");
  const [cropType, setCropType] = useState(app?.cropType ?? "");
  const [yearsFarming, setYearsFarming] = useState(app ? String(app.yearsFarming) : "");
  const [context, setContext] = useState({ source: "OFFICE", remarks: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const fields: Record<string, unknown> = {};
      if (name !== member.name) fields.name = name;
      if (role !== member.role) fields.role = role;
      if (active !== member.active) fields.active = active;

      const profile: Record<string, unknown> = {};
      if (app) {
        if (fullName !== app.fullName) profile.fullName = fullName;
        if (age !== String(app.age)) profile.age = Number(age);
        if (gender !== app.gender) profile.gender = gender;
        if (address !== app.address) profile.address = address;
        if (contact !== app.contact) profile.contact = contact;
        if (farmSize !== String(app.farmSize)) profile.farmSize = Number(farmSize);
        if (cropType !== app.cropType) profile.cropType = cropType;
        if (yearsFarming !== String(app.yearsFarming)) profile.yearsFarming = Number(yearsFarming);
      }
      if (Object.keys(profile).length > 0) fields.profile = profile;

      if (Object.keys(fields).length === 0) {
        setError("No changes to save");
        setBusy(false);
        return;
      }

      await patchJson("/api/admin-actions/profile", {
        memberId: member.id,
        fields,
        source: context.source,
        remarks: context.remarks || undefined,
        reason: context.reason || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Edit Profile"
      subtitle={`Member record for ${member.name}`}
      icon={PenLine}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="MEMBER">Member</option>
            <option value="TREASURER">Treasurer</option>
            <option value="PRESIDENT">President</option>
            <option value="SECRETARY">Secretary</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-[#0f2318]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#1b5e3b]" />
        Account active
      </label>

      {app ? (
        <>
          <div className="h-px bg-[#e2ebe6]" />
          <div>
            <label className={labelClass}>Full name (application)</label>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Age</label>
              <input className={inputClass} type="number" min="18" max="100" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Contact</label>
            <input className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Farm (ha)</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Years farming</label>
              <input className={inputClass} type="number" min="0" max="80" value={yearsFarming} onChange={(e) => setYearsFarming(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Crop</label>
              <input className={inputClass} value={cropType} onChange={(e) => setCropType(e.target.value)} />
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-xs text-[#5a7267]">
          No application profile on file — only account-level fields can be edited.
        </p>
      )}
      <ContextFields value={context} onChange={setContext} />
    </ModalShell>
  );
}

export default function AdminActionsPanel({ onDone }: { onDone?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<MemberSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [catalogs, setCatalogs] = useState<{ machines: MachineCatalog[]; supplies: SupplyCatalog[] }>({ machines: [], supplies: [] });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCatalogs = useCallback(async () => {
    const [machineRes, supplyRes] = await Promise.all([
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/supplies").then((r) => r.json()),
    ]);
    setCatalogs({
      machines: machineRes.machines?.map((m: MachineCatalog & { bookedDates?: unknown[] }) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        imageUrl: m.imageUrl,
      })) ?? [],
      supplies: supplyRes.supplies ?? [],
    });
  }, []);

  const loadSummary = useCallback(async (memberId: string) => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/admin-actions/members?id=${memberId}`);
      const data = await res.json();
      if (res.ok && data.members?.[0]) setSelected(data.members[0]);
      else setError(data.error || "Could not load member summary");
    } catch {
      setError("Could not load member summary");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  async function runSearch(q: string) {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/admin-actions/members?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (res.ok) setResults(data.members ?? []);
      else setError(data.error || "Search failed");
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(next), 350);
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function selectMember(m: MemberSummary) {
    setSelected(m);
    setResults([]);
    setQuery("");
    setSearched(false);
    setError(null);
  }

  async function handleOpenAction(kind: ActionKind) {
    setError(null);
    if ((kind === "machine" || kind === "supply") && catalogs.machines.length === 0 && catalogs.supplies.length === 0) {
      await loadCatalogs();
    }
    setAction(kind);
  }

  async function handleActionSuccess() {
    if (selected) await loadSummary(selected.id);
    setSuccess(`${ACTION_META[action as ActionKind].label} recorded for ${selected?.name ?? "member"}.`);
    setAction(null);
    onDone?.();
  }

  function handleCloseModal() {
    setAction(null);
  }

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const activeLoan = selected?.activeLoan ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm animate-fadeIn">
        <div className="mb-3 flex items-center gap-2">
          <Landmark size={16} className="text-[#1b5e3b]" />
          <h3 className="text-sm font-bold text-[#0f2318]">Member Service Center</h3>
        </div>
        <p className="mb-4 text-[11px] text-[#5a7267]">
          Perform member actions on behalf of a member. Every entry is recorded as a manual office transaction with a full audit trail.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5a7267]" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search member by name or username…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch(query);
                }
              }}
            />
          </div>
          <button
            onClick={() => runSearch(query)}
            className="rounded-lg bg-[#1b5e3b] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#15503a] active:scale-[0.98]"
          >
            Search
          </button>
        </div>

        {searching && <p className="mt-3 flex items-center gap-2 text-xs text-[#5a7267]"><Loader2 size={13} className="animate-spin" />Searching…</p>}
        {searched && !searching && (
          <div className="mt-3 space-y-1.5">
            {results.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3.5 py-3 text-xs text-[#5a7267]">No members found.</p>
            ) : (
              results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMember(m)}
                  className="flex w-full items-center justify-between rounded-lg border border-[#eef2e8] bg-[#fafdf7] px-3.5 py-2.5 text-left transition hover:border-[#1b5e3b]/40 hover:bg-[#f0f7eb] active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#173a2b] truncate">{m.name}</p>
                    <p className="text-[11px] text-[#718176]">@{m.username} · {m.application?.farmSize ? `${m.application.farmSize} ha · ` : ""}{m.application?.cropType ?? "no application on file"}</p>
                  </div>
                  <ChevronRight size={14} className="ml-2 shrink-0 text-[#5a7267]" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
          <XCircle size={16} className="shrink-0" />{error}
          <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 size={16} className="shrink-0" />{success}
        </div>
      )}

      {loadingSummary && (
        <div className="h-64 animate-pulse rounded-xl border border-[#e2ebe6] bg-white" />
      )}

      {selected && !loadingSummary && (
        <div className="space-y-4 animate-fadeIn">
          <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#1b5e3b] text-sm font-bold text-white">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0f2318]">{selected.name}</p>
                  <p className="text-[11px] text-[#5a7267]">@{selected.username} · {selected.role.toLowerCase()} · joined {selected.joined ? new Date(selected.joined).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${selected.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {selected.active ? "Active" : "Inactive"}
              </span>
            </div>
            {selected.application && (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-[#fafdf9] p-3.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                <div><span className="text-[#718176]">Farm:</span> <span className="font-semibold text-[#173a2b]">{selected.application.farmSize} ha</span></div>
                <div><span className="text-[#718176]">Crop:</span> <span className="font-semibold text-[#173a2b]">{selected.application.cropType}</span></div>
                <div><span className="text-[#718176]">Address:</span> <span className="font-semibold text-[#173a2b]">{selected.application.address}</span></div>
                <div><span className="text-[#718176]">Contact:</span> <span className="font-semibold text-[#173a2b]">{selected.application.contact}</span></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(["loan", "machine", "supply", "payment", "profile"] as ActionKind[]).map((kind) => {
              const meta = ACTION_META[kind];
              const Icon = meta.icon;
              const disabled = kind === "loan" && !!activeLoan;
              return (
                <button
                  key={kind}
                  onClick={() => handleOpenAction(kind)}
                  disabled={disabled}
                  className={`flex flex-col items-start gap-2 rounded-xl border border-[#e2ebe6] border-l-4 ${meta.accent} bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0f7eb] text-[#1b5e3b]"><Icon size={16} /></span>
                  <div>
                    <p className="text-xs font-bold text-[#0f2318]">{meta.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-[#5a7267]">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Loan accounts</h4>
              {selected.loans.length === 0 ? (
                <p className="text-xs text-[#5a7267]">No loan accounts.</p>
              ) : (
                <div className="space-y-2">
                  {selected.loans.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-[#eef2e8] bg-[#fafdf7] px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#173a2b]">{l.name}</p>
                        <p className="text-[11px] text-[#718176]">₱{l.amount.toLocaleString()} · {l.remainingBalance.toLocaleString()} remaining</p>
                      </div>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[l.status] ?? "bg-gray-100 text-gray-600"}`}>{l.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#e2ebe6] bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5a7267]">Recent activity</h4>
              {selected.machineRequests.length === 0 && selected.supplyTransactions.length === 0 && selected.payments.length === 0 ? (
                <p className="text-xs text-[#5a7267]">No machine, supply, or payment activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {selected.machineRequests.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eef2e8] bg-[#fafdf7] px-3.5 py-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#173a2b]"><Tractor size={11} className="mr-1.5 inline text-[#5a7267]" />{r.machineName}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                    </div>
                  ))}
                  {selected.supplyTransactions.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eef2e8] bg-[#fafdf7] px-3.5 py-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#173a2b]"><Package size={11} className="mr-1.5 inline text-[#5a7267]" />{t.productName} × {t.quantity}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[t.status] ?? "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                    </div>
                  ))}
                  {selected.payments.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eef2e8] bg-[#fafdf7] px-3.5 py-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#173a2b]"><Wallet size={11} className="mr-1.5 inline text-[#5a7267]" />₱{p.amount.toLocaleString()} · {p.type.replace("_", " ").toLowerCase()}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {action === "loan" && selected && (
        <LoanModal member={selected} disabled={!!activeLoan} onClose={handleCloseModal} onSuccess={handleActionSuccess} />
      )}
      {action === "machine" && selected && (
        <MachineModal member={selected} machines={catalogs.machines} onClose={handleCloseModal} onSuccess={handleActionSuccess} />
      )}
      {action === "supply" && selected && (
        <SupplyModal member={selected} supplies={catalogs.supplies} onClose={handleCloseModal} onSuccess={handleActionSuccess} />
      )}
      {action === "payment" && selected && (
        <PaymentModal member={selected} onClose={handleCloseModal} onSuccess={handleActionSuccess} />
      )}
      {action === "profile" && selected && (
        <ProfileModal member={selected} onClose={handleCloseModal} onSuccess={handleActionSuccess} />
      )}
    </div>
  );
}
