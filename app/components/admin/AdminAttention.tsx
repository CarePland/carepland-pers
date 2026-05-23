"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type AdminAttentionBadgeProps = {
  count?: number;
  label?: string;
  selected?: boolean;
  tone?: "followup" | "new";
};

type AdminNavButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  description?: ReactNode;
  followupCount?: number;
  isSelected?: boolean;
  newCount?: number;
};

export function AdminAttentionBadge({
  count,
  label = "New",
  selected = false,
  tone = "new",
}: AdminAttentionBadgeProps) {
  if (!count || count <= 0) {
    return null;
  }

  const toneClasses =
    tone === "new"
      ? selected
        ? "bg-red-100 text-red-700"
        : "bg-red-50 text-red-700"
      : selected
        ? "bg-amber-100 text-amber-800"
        : "bg-amber-50 text-amber-800";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClasses}`}
    >
      {count > 1 ? `${count} ${label}` : label}
    </span>
  );
}

export function AdminNavButton({
  children,
  className = "",
  description,
  followupCount = 0,
  isSelected = false,
  newCount = 0,
  ...buttonProps
}: AdminNavButtonProps) {
  const attentionTone =
    newCount > 0 ? "new" : followupCount > 0 ? "followup" : "none";
  const stateClasses = (() => {
    if (isSelected && attentionTone === "new") {
      return "border-red-700 bg-red-700 text-white";
    }

    if (isSelected && attentionTone === "followup") {
      return "border-amber-500 bg-amber-500 text-slate-950";
    }

    if (isSelected) {
      return "border-blue-700 bg-blue-700 text-white";
    }

    if (attentionTone === "new") {
      return "border-red-300 bg-red-50 text-red-950 hover:border-red-400 hover:bg-red-100";
    }

    if (attentionTone === "followup") {
      return "border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-400 hover:bg-amber-100";
    }

    return "border-slate-300 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50";
  })();

  return (
    <button
      className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${stateClasses} ${className}`}
      type="button"
      {...buttonProps}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0">{children}</span>
        <AdminAttentionBadge
          count={newCount}
          label="New"
          selected={isSelected}
          tone="new"
        />
        <AdminAttentionBadge
          count={followupCount}
          label="Followup"
          selected={isSelected}
          tone="followup"
        />
      </span>
      {description ? (
        <span
          className={`mt-1 block text-xs font-normal ${
            isSelected ? "text-white/80" : "text-slate-500"
          }`}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}
