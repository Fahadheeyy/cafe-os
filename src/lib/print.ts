/**
 * 80mm thermal-receipt printer via `window.open` + `window.print`.
 * Opens a small popup with print-friendly CSS, then triggers the OS
 * print dialog. Throws a friendly error if the popup is blocked so
 * callers can toast the message through `tryRun`.
 */
import type { Order } from "@/lib/services/orders.service";
import { money } from "@/lib/format";

export type PrintSettings = {
  restaurantName: string;
  currency: string;
  taxPercent: number;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function printBill(order: Order, settings: PrintSettings) {
  const currency = settings.currency;
  const taxRate = settings.taxPercent || 0;
  const itemsTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const parcelFee = order.parcelFee || 0;
  const subtotal = itemsTotal + parcelFee;
  const taxAmt = +(subtotal * taxRate / 100).toFixed(2);
  const grand = +(subtotal + taxAmt).toFixed(2);
  const when = new Date(order.paidAt ?? order.createdAt).toLocaleString();

  const rows = order.items
    .map(
      (i) => `
        <tr>
          <td>${esc(i.name)}</td>
          <td class="c">${i.qty}</td>
          <td class="r">${esc(money(i.price, currency))}</td>
          <td class="r">${esc(money(i.price * i.qty, currency))}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Bill · ${esc(order.tableName ?? "Takeaway")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; margin: 0; padding: 16px; }
  .receipt { width: 280px; margin: 0 auto; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; letter-spacing: 1px; }
  .muted { color: #555; font-size: 11px; text-align: center; }
  .sep { border-top: 1px dashed #999; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 3px 0; text-align: left; }
  th.c, td.c { text-align: center; }
  th.r, td.r { text-align: right; }
  thead th { border-bottom: 1px dashed #999; font-weight: 600; }
  .row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .row.total { font-size: 14px; font-weight: 700; padding-top: 6px; border-top: 1px dashed #999; margin-top: 6px; }
  .footer { text-align: center; font-size: 11px; margin-top: 12px; color: #555; }
  @media print {
    @page { size: 80mm auto; margin: 4mm; }
    body { padding: 0; }
  }
</style></head><body>
<div class="receipt">
  <h1>${esc(settings.restaurantName)}</h1>
  <p class="muted">${esc(order.tableName ?? "Takeaway")} · ${esc(when)}</p>
  <p class="muted">Server: ${esc(order.staffName)}</p>
  <div class="sep"></div>
  <table>
    <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sep"></div>
  <div class="row"><span>Items Total</span><span>${esc(money(itemsTotal, currency))}</span></div>
  ${parcelFee ? `<div class="row"><span>Parcel Fee</span><span>${esc(money(parcelFee, currency))}</span></div>` : ""}
  ${taxRate ? `<div class="row"><span>Tax (${taxRate}%)</span><span>${esc(money(taxAmt, currency))}</span></div>` : ""}
  <div class="row total"><span>Total</span><span>${esc(money(grand, currency))}</span></div>
  <div class="row"><span>Payment</span><span>${order.payment === "paid" ? `PAID · ${(order.paymentMethod ?? "cash").toUpperCase()}` : "UNPAID"}</span></div>
  <div class="footer">Thank you — visit again!</div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 100); };</script>
</body></html>`;

  try {
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) throw new Error("Print window was blocked. Please allow pop-ups for this site.");
    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (writeErr) {
      w.close(); // prevent orphaned blank popup
      throw writeErr;
    }
    return true;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Could not open the print window.");
  }
}
