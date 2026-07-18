/**
 * Named date ranges (today / week / month) as `{ start, end }` epoch-ms
 * pairs. Weeks start on Monday. Use `inRange(ts, r)` for filtering.
 */
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type Range = { start: number; end: number };

const toRange = (start: Date, end: Date): Range => ({
  start: start.getTime(),
  end: end.getTime(),
});

export const todayRange = (ref: Date = new Date()): Range =>
  toRange(startOfDay(ref), endOfDay(ref));

export const weekRange = (ref: Date = new Date()): Range =>
  toRange(startOfWeek(ref, { weekStartsOn: 1 }), endOfWeek(ref, { weekStartsOn: 1 }));

export const monthRange = (ref: Date = new Date()): Range =>
  toRange(startOfMonth(ref), endOfMonth(ref));

export const dayRangeAt = (ts: number): Range => todayRange(new Date(ts));

/** Inclusive-start, inclusive-end containment check. */
export const inRange = (ts: number, r: Range) => ts >= r.start && ts <= r.end;
