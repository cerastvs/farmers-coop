"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";

export interface MemberOption {
  id: string;
  name: string;
  username: string;
}

/**
 * Members are matched on either the name or the username, because the officer
 * looking for someone is as likely to know "lee" as "Lee Rika Dela Cruz" and
 * the co-op identifies members by username everywhere else.
 */
export function filterMembers(
  members: MemberOption[],
  query: string,
): MemberOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q),
  );
}

interface MemberFilterProps {
  members: MemberOption[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Member search for the report filters.
 *
 * This was a native <select>, which quietly stops being usable somewhere
 * around forty members: no typing, no way to see which member is which, and
 * on a long list the browser collapses it to a single line with no indication
 * of the current value. Officers filter reports by individual members all the
 * time, so the picker is a real search box with suggestions.
 *
 * The suggestion list is portalled to the body rather than positioned
 * absolutely in place, because the filters live inside a scrolling panel that
 * would clip it.
 */
export function MemberFilter({ members, value, onChange }: MemberFilterProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [dropUp, setDropUp] = useState(false);

  const selected = useMemo(
    () => members.find((m) => m.id === value) ?? null,
    [members, value],
  );

  const matches = useMemo(
    () => filterMembers(members, query),
    [members, query],
  );

  // The field shows the chosen member's name, so it starts out blank when
  // nothing is filtered rather than implying a search is in progress.
  useEffect(() => {
    setQuery(selected?.name ?? "");
    setOpen(false);
    // Only react to the filter changing from outside; re-running this on every
    // query keystroke would wipe what the officer is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ top: r.bottom, left: r.left, width: r.width });
    // Open upwards when there is more room above than below, otherwise the
    // list can sit off the bottom of a short window.
    setDropUp(window.innerHeight - r.bottom < 260 && r.top > 260);
  }, []);

  useEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    measure();
    const onScroll = () => setOpen(false);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, measure]);

  // Reset the highlighted row whenever the result set changes underneath it.
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function choose(member: MemberOption | null) {
    onChange(member?.id ?? "");
    setQuery(member?.name ?? "");
    setOpen(false);
  }

  function handleInput(next: string) {
    setQuery(next);
    setOpen(true);
    // Typing means the officer is changing the filter, so any previous pick is
    // no longer what they asked for.
    if (selected && next !== selected.name) onChange("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (matches.length === 0 ? 0 : (i + dir + matches.length) % matches.length));
      return;
    }
    if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      choose(matches[active] ?? null);
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      } else if (selected) {
        choose(null);
      }
    }
  }

  const hasResults = matches.length > 0;
  const mounted = typeof document !== "undefined";

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="report-member-filter"
        className="text-[10px] font-bold uppercase tracking-wide text-[#718176]"
      >
        Member
      </label>
      <div ref={anchorRef} className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a9c92]"
        />
        <input
          id="report-member-filter"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search name or username"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && hasResults}
          aria-controls="report-member-filter-list"
          aria-autocomplete="list"
          className="w-full rounded-lg border border-[#dce5d9] bg-white py-1.5 pl-8 pr-7 text-xs text-[#0f2318] outline-none focus:border-[#2d8a56]"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear member filter"
            onClick={() => choose(null)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#8a9c92] transition-colors hover:bg-[#eef2e8] hover:text-[#0f2318]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {selected && !open && (
        <p className="text-[10px] text-[#5a7267]">
          <span className="font-semibold text-[#0f2318]">{selected.name}</span>
          <span className="text-[#8a9c92]"> · @{selected.username}</span>
        </p>
      )}

      <span className="sr-only" aria-live="polite">
        {open
          ? hasResults
            ? `${matches.length} member${matches.length === 1 ? "" : "s"} match`
            : "No members match"
          : ""}
      </span>

      {open &&
        mounted &&
        box &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              ref={listRef}
              id="report-member-filter-list"
              role="listbox"
              style={
                dropUp
                  ? { bottom: window.innerHeight - box.top + 4, left: box.left, width: box.width }
                  : { top: box.top + 4, left: box.left, width: box.width }
              }
              className="fixed z-[61] max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-[#e2ebe6] bg-white py-1 shadow-2xl shadow-[#173a2b]/15"
            >
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                onClick={() => choose(null)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-[#f0f7eb]"
              >
                <span className="font-semibold text-[#0f2318]">All members</span>
                {!selected && <Check size={13} className="text-[#2d8a56]" />}
              </button>
              {hasResults ? (
                matches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={m.id === value}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(m)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-[#f0f7eb]" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#0f2318]">
                        {m.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#718176]">
                        @{m.username}
                      </span>
                    </span>
                    {m.id === value && (
                      <Check size={13} className="shrink-0 text-[#2d8a56]" />
                    )}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2.5 text-xs text-[#718176]">
                  No member matches “{query.trim()}”
                </p>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
