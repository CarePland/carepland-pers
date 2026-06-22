"use client";

import { gentleTextButtonClass, gentleWarmButtonClass } from "./uiStyles";

type InlineConfirmationProps = {
  cancelLabel: string;
  className?: string;
  confirmLabel: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function InlineConfirmation({
  cancelLabel,
  className = "",
  confirmLabel,
  message,
  onCancel,
  onConfirm,
}: InlineConfirmationProps) {
  return (
    <section
      className={`rounded-lg border border-blue-200 bg-[#f4faff] p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-blue-950">{message}</p>
        <div className="flex flex-wrap gap-2">
          <button
            className={gentleWarmButtonClass}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
          <button
            className={gentleTextButtonClass}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
