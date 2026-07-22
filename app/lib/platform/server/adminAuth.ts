import type { NextRequest } from "next/server";

import { createSupabaseUserClient, getActiveSupabaseUser } from "./supabase";

// Shared "Bearer token -> active account -> profiles.is_admin" check used by
// Admin-only API routes. Before this existed, the same four-step check
// (extract the token, resolve the active signed-in user, look up is_admin,
// throw if it isn't true) was hand-copied into roughly a dozen route files,
// with the same logic but route-specific message text and return shapes.
// This consolidates the check itself while leaving each route free to keep
// its own wording and its own return shape via the options below.
//
// This intentionally does not offer an "admin required, active account not
// required" mode. Every existing caller already requires an active account
// (via getActiveSupabaseUser, which enforces it internally), so there was no
// real "account may be inactive" variant of this check to preserve -- adding
// a branch for it would invent a distinction the codebase doesn't actually
// have.

export type AdminCaller = {
  email: string | null;
  userClient: ReturnType<typeof createSupabaseUserClient>;
  userId: string;
};

export type RequireAdminCallerOptions = {
  /** Message thrown when the caller is signed in but not an admin. */
  adminRequiredMessage?: string;
  /** Build a custom error for the "not an admin" case, e.g. to attach an HTTP status code. Defaults to `new Error(message)`. */
  makeAdminRequiredError?: (message: string) => Error;
  /** Build a custom error for the "not signed in" case, e.g. to attach an HTTP status code. Defaults to `new Error(message)`. */
  makeSignInError?: (message: string) => Error;
  /** Message thrown when there's no valid Bearer token, or the account isn't active. */
  signInMessage?: string;
};

const defaultSignInMessage = "Please sign in before continuing.";
const defaultAdminRequiredMessage = "Admin access is required to continue.";

/**
 * Resolves the caller of an Admin API route: extracts the Bearer token,
 * resolves the active signed-in user, and confirms `profiles.is_admin`.
 * Throws (via the message/error-factory options, so each route can keep its
 * own wording and error type) if any step fails.
 */
export async function requireAdminCaller(
  request: NextRequest | Request,
  options: RequireAdminCallerOptions = {}
): Promise<AdminCaller> {
  const signInMessage = options.signInMessage ?? defaultSignInMessage;
  const adminRequiredMessage = options.adminRequiredMessage ?? defaultAdminRequiredMessage;
  const makeSignInError = options.makeSignInError ?? ((message: string) => new Error(message));
  const makeAdminRequiredError =
    options.makeAdminRequiredError ?? ((message: string) => new Error(message));

  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) {
    throw makeSignInError(signInMessage);
  }

  const userClient = createSupabaseUserClient(accessToken);
  const user = await getActiveSupabaseUser(userClient, signInMessage);

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if ((profile as { is_admin?: boolean } | null)?.is_admin !== true) {
    throw makeAdminRequiredError(adminRequiredMessage);
  }

  return { email: user.email ?? null, userClient, userId: user.id };
}
