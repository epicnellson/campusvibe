/**
 * Centralized date utilities.
 * Handles Firestore Timestamps, epoch numbers, ISO strings, and plain date strings.
 */

/** Convert any date-like value to a Date (or null if unparseable). */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const ts = value as { seconds: number; nanoseconds?: number };
    const d = new Date(ts.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value > 1e12 ? value : value * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Safe wrapper around toDate that always returns a Date (epoch 0 on failure). */
function safeDate(value: unknown): Date {
  return toDate(value) ?? new Date(0);
}

/** e.g. "just now", "5m", "3h", "2d", "Jul 15" */
export function relativeTime(dateStr: unknown): string {
  const d = toDate(dateStr);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** e.g. "2:30 PM · Jul 15, 2026" */
export function fullTimestamp(dateStr: unknown): string {
  const d = safeDate(dateStr);
  if (d.getTime() === 0) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${time} \u00B7 ${date}`;
}

/** e.g. "Joined Jul 2026" */
export function joinDate(dateStr: unknown): string {
  const d = safeDate(dateStr);
  if (d.getTime() === 0) return "Joined";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Joined ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** e.g. "Jul 15" (for event date tags) */
export function eventDateTag(dateStr: unknown): string {
  const d = toDate(dateStr);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** e.g. "5m ago", "3h ago", "Jul 15" — for marketplace/listing cards. */
export function timeAgo(dateStr: unknown): string {
  const d = toDate(dateStr);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** e.g. "5m ago", "3h ago", "Jul 15" — for notifications (no "ago" suffix under 7d). */
export function formatRelative(dateStr: unknown): string {
  const d = toDate(dateStr);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString();
}

/** Returns { month, day, full } for event display. e.g. { month: "Jul", day: 15, full: "Mon, Jul 15" } */
export function eventDateParts(dateStr: unknown): { month: string; day: number; full: string } {
  const d = toDate(dateStr);
  if (!d) return { month: "", day: 0, full: "" };
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }),
    day: d.getDate(),
    full: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
  };
}

/** e.g. "Monday, July 15" — for event detail pages. */
export function eventFullDate(dateStr: unknown): string {
  const d = toDate(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
