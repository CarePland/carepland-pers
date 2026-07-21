"use client";

import { FormEvent, useEffect, useRef } from "react";

import { createAccountProcessingText } from "../../../lib/platform/createAccountFeedback";

type AuthMode =
  | "reset"
  | "signIn"
  | "signUp"
  | "signUpConfirmation"
  | "updatePassword";

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
  onResendConfirmationEmail?: () => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignUp: (event: FormEvent<HTMLFormElement>) => void;
  onUseDifferentSignUpEmail?: () => void;
  password: string;
  passwordsMismatch: boolean;
  signInButtonLabel?: string;
  signInDescription?: string;
  signUpConfirmationEmail?: string;
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
  onResendConfirmationEmail,
  onSignIn,
  onSignUp,
  onUseDifferentSignUpEmail,
  password,
  passwordsMismatch,
  signInButtonLabel,
  signInDescription,
  signUpConfirmationEmail,
  signedInEmail,
}: AuthGatewayPanelProps) {
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (
      authMode === "signUpConfirmation" ||
      (message && !loading) ||
      (authMode === "signUp" && loading)
    ) {
      statusRef.current?.focus();
    }
  }, [authMode, loading, message]);

  return (
    <>
      {!signedInEmail && message ? (
        <p
          aria-live="polite"
          className="mb-5 rounded-md bg-slate-100 p-3 text-sm text-slate-700"
          ref={statusRef}
          tabIndex={-1}
        >
          {message}
        </p>
      ) : null}

      {signedInEmail ? (
        <div>
          <h2 className="text-xl font-semibold">Signed in</h2>
          <p className="mt-2 break-words text-slate-600">{signedInEmail}</p>
        </div>
      ) : authMode === "signUpConfirmation" ? (
        <section aria-labelledby="auth-confirmation-heading">
          <h2
            className="text-xl font-semibold text-slate-950"
            id="auth-confirmation-heading"
          >
            Check your email
          </h2>
          <p
            aria-live="polite"
            className="mt-3 rounded-md bg-blue-50 p-3 text-sm leading-6 text-blue-950"
            ref={statusRef}
            tabIndex={-1}
          >
            We sent a confirmation link to{" "}
            <strong className="break-words">
              {signUpConfirmationEmail || "the email address you submitted"}
            </strong>
            . Open that link to finish creating your CarePland account.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            If this email can be used to create an account, the confirmation
            link will arrive shortly. Check your inbox and junk folder.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {onResendConfirmationEmail ? (
              <button
                className={gentlePrimaryButtonClass}
                disabled={loading}
                onClick={onResendConfirmationEmail}
                type="button"
              >
                {loading ? "Sending..." : "Resend confirmation email"}
              </button>
            ) : null}
            <button
              className={gentleSecondaryButtonClass}
              disabled={loading}
              onClick={() => {
                onUseDifferentSignUpEmail?.();
                onClearMessage();
              }}
              type="button"
            >
              Use a different email
            </button>
            <button
              className="font-semibold text-blue-700 disabled:text-slate-400"
              disabled={loading}
              onClick={() => {
                onChangeAuthMode("signIn");
                onClearMessage();
              }}
              type="button"
            >
              Return to sign in
            </button>
          </div>
        </section>
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
                  disabled={loading}
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
                  disabled={loading}
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
          {authMode === "signUp" && loading ? (
            <p
              aria-live="polite"
              className="mt-5 rounded-md bg-blue-50 p-3 text-sm font-semibold text-blue-900"
              ref={statusRef}
              tabIndex={-1}
            >
              {createAccountProcessingText}
            </p>
          ) : null}
          <label className="mt-5 block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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
            aria-busy={loading}
            className={`${gentlePrimaryButtonClass} mt-5 w-full`}
            disabled={!canSubmitAuth}
            type="submit"
          >
            {loading
              ? authMode === "signUp"
                ? createAccountProcessingText
                : "Working..."
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
