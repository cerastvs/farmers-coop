"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "../components/DashboardHeader";
import { MemberPageHeader } from "../components/MemberPageHeader";
import memberStyles from "../components/member.module.css";
import { fetchWithTimeout } from "../hooks/fetchWithTimeout";
import { usePolling } from "../hooks/usePolling";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/notifications");
      if (!res.ok) throw new Error("Unable to load notifications.");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unable to load notifications.");
      setNotifications(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  usePolling(fetchNotifications, 15_000);

  useEffect(() => {
    void fetchNotifications();
  }, []);

  async function markAsRead(ids?: string[]) {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Unable to mark notifications as read.");
      await fetchNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark notifications as read.");
    }
  }

  async function deleteNotification(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete notification.");
      await fetchNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete notification.");
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={memberStyles.surface}>
      <DashboardHeader />
      <main className="mx-auto w-full px-4 py-8">
        <MemberPageHeader title="Notifications" description="Updates about your requests, payments, and cooperative account." />
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#ccd4c8] pb-4">
            <p className="text-sm font-semibold text-[#536b5f]">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
            {unreadCount > 0 && <button onClick={() => markAsRead()} className="inline-flex items-center gap-2 bg-[#173b31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2d6848]"><CheckCheck size={16} /> Mark all read</button>}
          </div>
          {error && <div role="alert" className={memberStyles.error}>{error}<button onClick={() => fetchNotifications()}>Try again</button></div>}
          {loading ? (
            <p className="py-12 text-center text-sm text-[#536b5f]">Loading notifications…</p>
          ) : notifications.length === 0 && !error ? (
            <div className="border border-dashed border-[#ccd4c8] bg-white px-6 py-14 text-center"><Bell size={27} className="mx-auto mb-3 text-[#416747]" /><p className="text-sm text-[#536b5f]">No notifications yet.</p></div>
          ) : (
            <div className="border-t border-[#173b31]">
              {notifications.map((n) => (
                <article key={n.id} className={`grid gap-4 border-b border-[#ccd4c8] px-3 py-5 sm:grid-cols-[1fr_auto] ${n.read ? "bg-transparent" : "bg-[#e7efdf]"}`}>
                  <div>
                    <div className="flex items-center gap-2"><h2 className="text-base font-bold text-[#173b31]">{n.title}</h2>{!n.read && <span className="h-2 w-2 rounded-full bg-[#416747]" aria-label="Unread" />}</div>
                    <p className="mt-1 text-sm leading-6 text-[#536b5f]">{n.message}</p>
                    <time className="mt-3 block text-xs text-[#6b8074]" dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                  <div className="flex items-start gap-2">
                    {!n.read && <button onClick={() => markAsRead([n.id])} className="border border-[#b9c8b9] px-3 py-1.5 text-xs font-bold text-[#173b31] hover:bg-white">Mark read</button>}
                    <button onClick={() => deleteNotification(n.id)} className="border border-[#b9c8b9] p-1.5 text-[#536b5f] hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${n.title}`}><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
