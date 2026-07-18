/**
 * Shared formatting helpers. Keep display strings consistent across
 * receipts, tables, cards, and charts — never call `.toFixed()` /
 * `.toLocaleString()` directly in components.
 */
import { format } from "date-fns";

/** Format a number as currency. Defaults to ₹. */
export const money = (n: number, currency = "₹") =>
  `${currency}${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

/** Short date, e.g. "17 Jul 2026". */
export const shortDate = (ts: number | Date) => format(ts, "d MMM yyyy");

/** Short time, e.g. "14:32". */
export const shortTime = (ts: number | Date) => format(ts, "HH:mm");

/** Combined date + time, e.g. "17 Jul, 14:32". */
export const dateTime = (ts: number | Date) => format(ts, "d MMM, HH:mm");
