/**
 * Pure pricing math. Never depend on React or the store here — these
 * helpers are shared by the POS cart, receipts, and the purchase entry
 * form so tax + total logic can never drift between screens.
 */
import type { OrderItem } from "@/lib/store";

/** Sum of line items (qty × price). */
export function computeSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

/** Compute subtotal, tax, and total for an order. */
export function computeOrderTotals(items: OrderItem[], taxPercent = 0) {
  const subtotal = computeSubtotal(items);
  const tax = +(subtotal * (taxPercent / 100)).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  return { subtotal, tax, total };
}

/** Compute purchase totals from line entries with a per-line `total`. */
export function computePurchaseTotals(
  lines: { total: number }[],
  tax = 0,
): { subtotal: number; tax: number; total: number } {
  const subtotal = lines.reduce((s, l) => s + (l.total || 0), 0);
  return { subtotal, tax, total: subtotal + tax };
}
