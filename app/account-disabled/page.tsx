import { redirect } from "next/navigation";

import { getAccountStatus } from "@/lib/account-status";
import prisma from "@/lib/client";
import { getSession } from "@/lib/session";
import { logout } from "../login/actions";
import { ReactivationRequestButton } from "./ReactivationRequestButton";

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

/**
 * Notice page for a disabled account.
 *
 * Reached when an officer sets `active = false`. The session is deliberately
 * left intact so the member can read this and ask for reactivation — every
 * other route rejects them at the API boundary anyway.
 */
export default async function AccountDisabledPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, username: true, active: true },
  });
  if (!user) redirect("/login");

  // Nothing to explain to someone whose account is fine.
  if (user.active) redirect("/dashboard");

  const status = await getAccountStatus(user.id);
  const disabledOn = formatDate(status.deactivatedAt);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f2] p-6 text-[#173a2b]">
      <div className="w-full max-w-lg rounded-3xl border border-[#e3d9c8] bg-white p-8 shadow-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fdf1e3] px-3 py-1 text-xs font-bold text-[#a15c1c]">
          Account disabled
        </span>

        <h1 className="mt-4 text-2xl font-black text-[#173a2b]">
          Your account has been disabled
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5d6b61]">
          Hello {user.name ?? user.username}, a cooperative officer has disabled
          your account, so you cannot use loans, supplies, or machine bookings
          until it is restored.
        </p>

        {disabledOn && (
          <p className="mt-3 text-xs text-[#8a968d]">Disabled on {disabledOn}</p>
        )}

        {status.deactivationReason ? (
          <div className="mt-5 rounded-2xl border border-[#e3d9c8] bg-[#fdf8f1] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#a15c1c]">
              Reason given by the officer
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#4a3b2a]">
              {status.deactivationReason}
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-[#e3e9e0] bg-[#f7faf5] p-4 text-sm text-[#5d6b61]">
            No reason was recorded. You can still ask the officers to review
            your account.
          </p>
        )}

        <div className="mt-6 border-t border-[#eef2e8] pt-5">
          <ReactivationRequestButton
            alreadyRequested={status.openReactivationRequest !== null}
            requestedAt={
              status.openReactivationRequest
                ? formatDate(status.openReactivationRequest.at)
                : null
            }
          />
        </div>

        <form action={logout} className="mt-4">
          <button
            type="submit"
            className="text-sm font-semibold text-[#718176] underline underline-offset-4 hover:text-[#173a2b]"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
