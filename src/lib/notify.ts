/**
 * Unified notifications + error handling.
 *
 * - `notify.success / info / warn` — thin wrappers around `sonner`.
 * - `notify.error(err)` — toasts a friendly message, logs the raw error to
 *   the console, and forwards `Error` instances to Lovable error capture.
 * - `tryRun(fn, { success, error })` — runs a (possibly async) action and
 *   routes any throw through `notify.error`. Use it around every store
 *   mutation triggered by a user action.
 * - `parsePositiveNumber` / `parseRequiredString` — friendly form validators.
 */
import { toast } from "sonner";
import { reportLovableError } from "./lovable-error-reporting";

/** Extract a human-readable string from anything thrown. */
export function toErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

export const notify = {
  success(message: string, description?: string) {
    toast.success(message, description ? { description } : undefined);
  },
  info(message: string, description?: string) {
    toast.info(message, description ? { description } : undefined);
  },
  warn(message: string, description?: string) {
    toast.warning(message, description ? { description } : undefined);
  },
  error(err: unknown, fallback = "Something went wrong") {
    const msg = toErrorMessage(err, fallback);
    // Log the raw error so stack traces reach Server / Browser Logs.
    // eslint-disable-next-line no-console
    console.error("[cafeos]", err);
    if (err instanceof Error) {
      try {
        reportLovableError(err, { boundary: "notify.error" });
      } catch {
        /* ignore reporter failure */
      }
    }
    toast.error(msg);
  },
};

type TryOpts = {
  /** Toast on success. Omit to stay silent on success. */
  success?: string;
  /** Fallback error message when the thrown value has none. */
  error?: string;
};

/**
 * Run a (possibly async) action with unified toast + logging on failure.
 * Returns the resolved value, or `undefined` if it threw.
 *
 *   await tryRun(() => store.setStockBalance(id, +v), { success: "Saved" });
 */
export async function tryRun<T>(
  fn: () => T | Promise<T>,
  opts: TryOpts = {},
): Promise<T | undefined> {
  try {
    const result = await fn();
    if (opts.success) notify.success(opts.success);
    return result;
  } catch (err) {
    notify.error(err, opts.error);
    return undefined;
  }
}

/** Parse and validate a positive-number input; throws with a friendly message. */
export function parsePositiveNumber(value: string | number, field = "Value"): number {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  if (n < 0) throw new Error(`${field} cannot be negative`);
  return n;
}

/** Parse and validate a required non-empty string. */
export function parseRequiredString(value: string, field = "Field"): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}
