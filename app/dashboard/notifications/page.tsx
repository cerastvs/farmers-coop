"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "../components/DashboardHeader";
import { Bell, CheckCheck, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function markAsRead(ids?: string[]) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }

  async function deleteNotification(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#edf5df]">
      <DashboardHeader />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#718176] hover:text-[#39733e] mb-4"
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#174b36] text-white">
              <Bell size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#173a2b]">Notifications</h1>
              <p className="text-xs text-[#718176]">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="flex items-center gap-1.5 rounded-lg bg-[#174b36] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0e3b2a]"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#174b36] border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d5ddd0] bg-white/60 p-12 text-center">
            <Bell size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-[#718176]">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) markAsRead([n.id]);
                }}
                className={`relative rounded-2xl border p-4 transition cursor-pointer ${
                  n.read
                    ? "border-[#eef2e8] bg-white"
                    : "border-blue-200 bg-blue-50/50"
                }`}
              >
                {!n.read && (
                  <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-blue-500" />
                )}
                <p className={`text-sm font-bold ${n.read ? "text-[#173a2b]" : "text-[#0e3b2a]"}`}>
                  {n.title}
                </p>
                <p className="mt-1 text-sm text-[#718176] leading-relaxed">
                  {n.message}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
