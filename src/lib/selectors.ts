/**
 * Store selectors and derived-data helpers. Hooks use `useShallow` so
 * components only re-render when the returned slice actually changes.
 * Prefer these over reading raw arrays from `useStore` when you need
 * more than one slice at once.
 */
import { useShallow } from "zustand/react/shallow";
import { useStore, type Order } from "@/lib/store";
import { inRange, todayRange, type Range } from "@/lib/date-range";

/** Subscribe to multiple store slices with shallow equality — avoids re-render storms. */
export const useOrders = () => useStore(useShallow((s) => s.orders));
export const useProducts = () => useStore(useShallow((s) => s.products));
export const useTables = () => useStore(useShallow((s) => s.tables));
export const useStockItems = () => useStore(useShallow((s) => s.stockItems));
export const useRequests = () => useStore(useShallow((s) => s.purchaseRequests));
export const useSettings = () => useStore((s) => s.settings);

const isPaid = (o: Order) => o.payment === "paid";

export function paidInRange(orders: Order[], range: Range): Order[] {
  return orders.filter(
    (o) => isPaid(o) && inRange(o.paidAt ?? o.createdAt, range),
  );
}

export function paidToday(orders: Order[]): Order[] {
  return paidInRange(orders, todayRange());
}

export function revenue(orders: Order[]): number {
  return orders.reduce((s, o) => s + o.total, 0);
}

export function splitByPaymentMethod(orders: Order[]) {
  return orders.reduce(
    (acc, o) => {
      const key = o.paymentMethod ?? "cash";
      acc[key] = (acc[key] ?? 0) + o.total;
      return acc;
    },
    { upi: 0, cash: 0 } as Record<"upi" | "cash", number>,
  );
}
