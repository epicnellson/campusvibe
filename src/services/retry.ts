const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  baseDelay = BASE_DELAY
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("timeout") ||
      msg.includes("ecannot") ||
      msg.includes("enotfound") ||
      msg.includes("econnrefused") ||
      msg.includes("network request failed")
    );
  }
  return false;
}

export function isSupabaseError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as any).code;
    return typeof code === "string" && code.startsWith("PGRST");
  }
  return false;
}

export function getSupabaseErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as any;
  if (e.code === "PGRST301") return "Database connection lost. Please try again.";
  if (e.code === "PGRST116") return "Session expired. Please log in again.";
  if (e.code === "42501") return "You don't have permission to perform this action.";
  if (e.code === "23505") return "This item already exists.";
  if (e.code === "23503") return "Referenced item was not found.";
  if (e.message?.includes("JWT")) return "Session expired. Please log in again.";
  if (e.message?.includes("Failed to fetch")) return "Unable to reach server. Check your connection.";
  return null;
}

export function getAuthErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "An unexpected error occurred";
  const e = err as any;
  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("wrong password") || msg.includes("invalid password"))
    return "Incorrect password. Try again or reset it.";
  if (msg.includes("user not found") || msg.includes("email not found"))
    return "No account found with this email.";
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("email already"))
    return "An account already exists. Log in instead.";
  if (msg.includes("otp") && (msg.includes("expired") || msg.includes("invalid")))
    return "Code expired. Tap resend for a new one.";
  if (msg.includes("too many") || msg.includes("rate limit") || msg.includes("429"))
    return "Too many tries. Wait 10 minutes and retry.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Unable to connect. Check your internet.";
  return e.message ?? "Something went wrong. Please try again.";
}
