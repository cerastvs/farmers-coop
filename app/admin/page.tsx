"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageModal } from "@/components/ImageModal";
import { runAdminMutation } from "@/lib/admin-mutation";

type Role = "APPLICANT" | "MEMBER" | "TREASURER" | "PRESIDENT" | "SECRETARY";
type Tab = "loans" | "payments" | "supplies" | "members" | "reports" | "posts";
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
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
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
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  const tabs = useMemo(() => {
    if (!user) return [] as Tab[];
    const result: Tab[] = ["members", "reports", "posts"];
    if (["PRESIDENT", "TREASURER"].includes(user.role)) result.unshift("loans", "payments");
    if (["SECRETARY", "TREASURER"].includes(user.role)) result.splice(result.includes("payments") ? 2 : 0, 0, "supplies");
    return result;
  }, [user]);

  const loadTab = useCallback(async (selected: Tab) => {
    const endpoints: Record<Tab, string> = {
      loans: "/api/admin/loans",
      payments: "/api/admin/payments",
      supplies: "/api/admin/supplies",
      members: "/api/admin/members",
      reports: "/api/admin/reports",
      posts: "/api/posts?includeDrafts=true",
    };
    setLoading(true);
    try {
      const data = await requestJson(endpoints[selected]);
      if (selected === "loans") setLoans(data);
      if (selected === "payments") setPayments(data);
      if (selected === "supplies") setSupplies(data);
      if (selected === "members") setMembers(data.members ?? data);
      if (selected === "reports") setReports(data.reports ?? data);
      if (selected === "posts") setPosts(data.posts ?? data);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load records" });
    } finally {
      setLoading(false);
    }
  }, []);

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
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold capitalize ${tab === item ? "bg-[#26633f] text-white" : "border border-[#dce5d9] bg-white text-[#496558]"}`}
            >
              {item}
            </button>
          ))}
        </div>

        {notice && (
          <p aria-live="polite" className={`mb-5 rounded-xl px-4 py-3 text-sm ${notice.kind === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {notice.text}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#e1e8de] bg-white p-10 text-center text-sm text-[#718176]">Loading {tab}…</div>
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
                    }, "Supply added.", "POST");
                    formElement.reset();
                  }}
                >
                  <input className={fieldClass} name="productName" required minLength={2} placeholder="Product name" />
                  <input className={fieldClass} name="price" required type="number" min="0" step="0.01" placeholder="Price" />
                  <input className={fieldClass} name="quantity" required type="number" min="0" placeholder="Stock" />
                  <button disabled={busy === "new-supply"} className={buttonClass}>Add item</button>
                </form>
                <RecordList empty="No inventory found.">
                  {supplies.map((supply) => (
                    <Record key={supply.id} title={supply.productName} meta={`₱${supply.price.toLocaleString()} · ${supply.quantity} in stock`}>
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void mutate(supply.id, `/api/admin/supplies/${supply.id}`, {
                            productName: form.get("productName"),
                            price: Number(form.get("price")),
                            quantity: Number(form.get("quantity")),
                          }, "Inventory updated.");
                        }}
                      >
                        <input className={`${fieldClass} min-w-44 flex-1`} name="productName" defaultValue={supply.productName} required />
                        <input aria-label="Price" className={`${fieldClass} w-28`} name="price" type="number" min="0" step="0.01" defaultValue={supply.price} required />
                        <input aria-label="Quantity" className={`${fieldClass} w-24`} name="quantity" type="number" min="0" defaultValue={supply.quantity} required />
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
                <RecordList empty="No generated reports found.">
                  {reports.map((report) => <Record key={report.id} title={report.title} meta={`${report.type} · ${new Date(report.createdAt).toLocaleString()}`} />)}
                </RecordList>
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
  const negative = ["REJECTED", "INACTIVE"].includes(value);
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${positive ? "bg-green-100 text-green-700" : negative ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{value}</span>;
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>;
}
