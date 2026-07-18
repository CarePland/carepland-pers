"use client";

import { FormEvent } from "react";

type AuthMode = "reset" | "signIn" | "signUp" | "updatePassword";

type AuthGatewayPanelProps = {
  authMode: AuthMode;
  canSubmitAuth: boolean;
  confirmPassword: string;
  email: string;
  gentlePrimaryButtonClass: string;
  gentleSecondaryButtonClass: string;
  heading?: string;
  loading: boolean;
  message: string;
  onChangeAuthMode: (mode: AuthMode) => void;
  onChangeConfirmPassword: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onClearMessage: () => void;
  onGoogleSignIn: () => void;
  onPasswordReset: (event: FormEvent<HTMLFormElement>) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignUp: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  passwordsMismatch: boolean;
  signInButtonLabel?: string;
  signInDescription?: string;
  signedInEmail: string | null;
};

export function AuthGatewayPanel({
  authMode,
  canSubmitAuth,
  confirmPassword,
  email,
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  heading,
  loading,
  message,
  onChangeAuthMode,
  onChangeConfirmPassword,
  onChangeEmail,
  onChangePassword,
  onClearMessage,
  onGoogleSignIn,
  onPasswordReset,
  onSignIn,
  onSignUp,
  password,
  passwordsMismatch,
  signInButtonLabel,
  signInDescription,
  signedInEmail,
}: AuthGatewayPanelProps) {
  return (
    <>
      {!signedInEmail && message ? (
        <p className="mb-5 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {signedInEmail ? (
        <div>
          <h2 className="text-xl font-semibold">Signed in</h2>
          <p className="mt-2 break-words text-slate-600">{signedInEmail}</p>
        </div>
      ) : (
        <form
          onSubmit={
            authMode === "signUp"
              ? onSignUp
              : authMode === "reset"
                ? onPasswordReset
                : onSignIn
          }
        >
          <h2 className="text-xl font-semibold text-slate-950">
            {heading ??
              (authMode === "signUp"
              ? "Create your account"
              : authMode === "reset"
                ? "Reset password"
                : "Welcome back")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {authMode === "signUp"
              ? "Create an account with email, or continue directly with Google."
              : authMode === "reset"
                ? "Enter your email and CarePland will send a reset link."
                : signInDescription ?? "Choose how you'd like to continue"}
          </p>
          {authMode !== "reset" ? (
            <>
              <button
                className={`${gentleSecondaryButtonClass} mt-5 flex w-full items-center justify-center gap-3`}
                disabled={loading}
                onClick={onGoogleSignIn}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-sm font-bold text-blue-700"
                >
                  G
                </span>
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>Or use email</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div
                aria-label="Email account action"
                className="grid grid-cols-2 rounded-full border border-blue-100 bg-blue-50/70 p-1 text-sm font-semibold"
                role="group"
              >
                <button
                  aria-pressed={authMode === "signIn"}
                  className={`rounded-full px-3 py-2 transition ${
                    authMode === "signIn"
                      ? "bg-white text-blue-800 shadow-sm"
                      : "text-slate-500 hover:text-blue-800"
                  }`}
                  onClick={() => {
                    onChangeAuthMode("signIn");
                    onClearMessage();
                  }}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  aria-pressed={authMode === "signUp"}
                  className={`rounded-full px-3 py-2 transition ${
                    authMode === "signUp"
                      ? "bg-white text-blue-800 shadow-sm"
                      : "text-slate-500 hover:text-blue-800"
                  }`}
                  onClick={() => {
                    onChangeAuthMode("signUp");
                    onClearMessage();
                  }}
                  type="button"
                >
                  Create account
                </button>
              </div>
            </>
          ) : null}
          <label className="mt-5 block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              onChange={(event) => onChangeEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          {authMode !== "reset" ? (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Password
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                minLength={8}
                onChange={(event) => {
                  onChangePassword(event.target.value);
                  onClearMessage();
                }}
                required
                type="password"
                value={password}
              />
            </label>
          ) : null}

          {authMode === "signUp" ? (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Confirm password
              <input
                aria-invalid={passwordsMismatch}
                className={`mt-2 w-full rounded-md border px-3 py-2 text-base ${
                  passwordsMismatch ? "border-red-500" : "border-slate-300"
                }`}
                minLength={8}
                onChange={(event) => {
                  onChangeConfirmPassword(event.target.value);
                  onClearMessage();
                }}
                required
                type="password"
                value={confirmPassword}
              />
              {passwordsMismatch ? (
                <span className="mt-2 block text-sm font-semibold text-red-700">
                  Passwords do not match.
                </span>
              ) : null}
            </label>
          ) : null}

          <button
            className={`${gentlePrimaryButtonClass} mt-5 w-full`}
            disabled={!canSubmitAuth}
            type="submit"
          >
            {loading
              ? "Working..."
              : authMode === "signUp"
                ? "Create account"
                : authMode === "reset"
                  ? "Send reset email"
                  : signInButtonLabel ?? "Sign in"}
          </button>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {authMode === "reset" ? (
              <button
                className="font-semibold text-blue-700"
                onClick={() => {
                  onChangeAuthMode("signIn");
                  onClearMessage();
                }}
                type="button"
              >
                Back to sign in
              </button>
            ) : (
              <button
                className="font-semibold text-blue-700"
                onClick={() => {
                  onChangeAuthMode("reset");
                  onClearMessage();
                }}
                type="button"
              >
                Forgot your password?
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
