"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type AdminAttentionBadgeProps = {
  count?: number;
  label?: string;
  selected?: boolean;
};

type AdminNavButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  description?: ReactNode;
  hasAttention?: boolean;
  isSelected?: boolean;
};

export function AdminAttentionBadge({
  count,
  label = "New",
  selected = false,
}: AdminAttentionBadgeProps) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        selected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
      }`}
    >
      {count > 1 ? `${count} ${label}` : label}
    </span>
  );
}

export function AdminNavButton({
  children,
  className = "",
  description,
  hasAttention = false,
  isSelected = false,
  ...buttonProps
}: AdminNavButtonProps) {
  const stateClasses = isSelected
    ? hasAttention
      ? "border-amber-600 bg-amber-600 text-white"
      : "border-blue-700 bg-blue-700 text-white"
    : hasAttention
      ? "border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-400 hover:bg-amber-100"
      : "border-slate-300 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50";

  return (
    <button
      className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${stateClasses} ${className}`}
      type="button"
      {...buttonProps}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0">{children}</span>
        <AdminAttentionBadge count={hasAttention ? 1 : 0} selected={isSelected} />
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
