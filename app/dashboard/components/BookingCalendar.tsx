"use client";

import { useState } from "react";

export interface BookedDate {
  startDate: string;
  endDate: string;
  status: string;
}

export interface MyRequest {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingCalendar({
  bookedDates,
  myRequests,
  startDate,
  endDate,
}: {
  bookedDates: BookedDate[];
  myRequests: MyRequest[];
  startDate: string;
  endDate: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function getDayStatus(day: number): "selected-conflict" | "my-approved" | "approved" | "pending" | "selected" | null {
    const dateStr = toISODate(new Date(viewYear, viewMonth, day));

    const inSelectedRange = startDate && endDate && dateStr >= startDate && dateStr <= endDate;
    let overlapsBooked = false;

    for (const bd of bookedDates) {
      const bdStart = bd.startDate.split("T")[0];
      const bdEnd = bd.endDate.split("T")[0];
      if (dateStr >= bdStart && dateStr <= bdEnd) {
        overlapsBooked = true;
        break;
      }
    }

    if (inSelectedRange && overlapsBooked) return "selected-conflict";
    if (inSelectedRange) return "selected";

    for (const bd of bookedDates) {
      const bdStart = bd.startDate.split("T")[0];
      const bdEnd = bd.endDate.split("T")[0];
      if (dateStr >= bdStart && dateStr <= bdEnd) {
        if (bd.status === "QUEUED") return "pending";

        const isOwn = myRequests.some(
          (r) =>
            r.status !== "QUEUED" &&
            r.startDate &&
            r.endDate &&
            r.startDate.split("T")[0] === bdStart &&
            r.endDate.split("T")[0] === bdEnd,
        );
        return isOwn ? "my-approved" : "approved";
      }
    }

    return null;
  }

  const DAY_STYLE: Record<string, string> = {
    "selected-conflict": "conflict-blink",
    "my-approved": "bg-green-100 text-green-700 font-bold",
    approved: "bg-red-100 text-red-700 font-bold",
    pending: "bg-orange-100 text-orange-700 font-bold",
    selected: "bg-[#174b36] text-white font-bold",
  };

  return (
    <div className="rounded-xl border border-[#d0dbd0] bg-white p-3">
      <style>{`
        @keyframes conflict-blink {
          0%, 100% { background-color: #dc2626; color: #fff; }
          50% { background-color: #fca5a5; color: #173a2b; }
        }
        .conflict-blink {
          animation: conflict-blink 0.7s ease-in-out infinite;
          font-weight: 800;
        }
      `}</style>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
        >
          ←
        </button>
        <span className="text-sm font-bold text-[#173a2b]">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100 transition"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[10px] font-bold text-gray-400 py-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const dateStr = toISODate(new Date(viewYear, viewMonth, day));
          const isPast = dateStr < todayISO();
          const status = isPast ? null : getDayStatus(day);

          return (
            <div
              key={day}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs ${
                status ? DAY_STYLE[status] : isPast ? "text-gray-300" : "text-[#173a2b]"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-300" />
          <span className="text-[10px] text-gray-500">Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="text-[10px] text-gray-500">Others&apos; approved</span>
        </div>
        {myRequests.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
            <span className="text-[10px] text-gray-500">Your reserved</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#174b36]" />
          <span className="text-[10px] text-gray-500">Your selection</span>
        </div>
      </div>
    </div>
  );
}
