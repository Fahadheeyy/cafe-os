/**
 * Translates raw Supabase Auth / Postgres errors into short, friendly messages
 * safe to render in the UI. Never leaks stack traces or SQL details.
 */
export function friendlyAuthError(err: unknown): string {
  if (!err) return "Something went wrong. Please try again.";
  const anyErr = err as { message?: string; code?: string; status?: number };
  const msg = anyErr.message ?? String(err);
  const code = anyErr.code ?? "";

  if (code === "email_address_invalid" || /invalid.*email/i.test(msg)) {
    return "Enter a valid email address.";
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "Incorrect email or password.";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already been registered|user already/i.test(msg)
  ) {
    return "An account with this email already exists. Try signing in.";
  }
  if (
    code === "weak_password" ||
    /password.{0,40}(short|weak|leaked|pwned|characters|compromis)/i.test(msg)
  ) {
    return "Password is too weak. Use at least 8 characters and avoid common passwords.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /rate limit/i.test(msg)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code === "email_not_confirmed") {
    return "Please confirm your email before signing in.";
  }
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return "Network problem. Check your connection and try again.";
  }
  if (/deactivated|inactive/i.test(msg)) {
    return "Your account is deactivated. Contact your Owner.";
  }
  if (/already belong to a business/i.test(msg)) {
    return "You already belong to a business.";
  }
  if (/not authenticated/i.test(msg)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/business name is required/i.test(msg)) {
    return "Business name is required.";
  }
  return msg || "Something went wrong. Please try again.";
}
