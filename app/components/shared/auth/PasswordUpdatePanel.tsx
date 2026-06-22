"use client";

import { FormEvent } from "react";

type PasswordUpdatePanelProps = {
  canSubmitAuth: boolean;
  confirmPassword: string;
  loading: boolean;
  message: string;
  onBackToSignIn: () => void;
  onChangeConfirmPassword: (value: string) => void;
  onChangePassword: (value: string) => void;
  onClearMessage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  passwordsMismatch: boolean;
};

export function PasswordUpdatePanel({
  canSubmitAuth,
  confirmPassword,
  loading,
  message,
  onBackToSignIn,
  onChangeConfirmPassword,
  onChangePassword,
  onClearMessage,
  onSubmit,
  password,
  passwordsMismatch,
}: PasswordUpdatePanelProps) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Set a new password</h2>
          <p className="mt-1 text-slate-600">
            Enter and confirm a new password for your CarePland account.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
          onClick={onBackToSignIn}
          type="button"
        >
          Back to sign in
        </button>
      </div>

      <form className="mt-5 max-w-xl space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          New password
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
        <label className="block text-sm font-medium text-slate-700">
          Confirm new password
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
        <button
          className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={!canSubmitAuth}
          type="submit"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
