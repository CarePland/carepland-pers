"use client";

import { ReactNode } from "react";

import {
  AdminNavButton,
  AdminNavGroup,
  type AdminNavItem,
} from "./AdminAttention";

type AdminWorkspaceShellProps<TopKey extends string, SecondaryKey extends string> = {
  activeSecondaryKey: SecondaryKey;
  activeTopKey: TopKey;
  children: ReactNode;
  onSelectSecondary: (key: SecondaryKey) => void;
  onSelectTop: (key: TopKey) => void;
  secondaryItems?: AdminNavItem<SecondaryKey>[];
  stickyTop: number;
  topItems: AdminNavItem<TopKey>[];
};

export function AdminWorkspaceShell<
  TopKey extends string,
  SecondaryKey extends string,
>({
  activeSecondaryKey,
  activeTopKey,
  children,
  onSelectSecondary,
  onSelectTop,
  secondaryItems,
  stickyTop,
  topItems,
}: AdminWorkspaceShellProps<TopKey, SecondaryKey>) {
  return (
    <>
      <section
        className="sticky z-40 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-wrap gap-2">
          {topItems.map((item) => (
            <AdminNavButton
              followupCount={item.followupCount ?? 0}
              isSelected={activeTopKey === item.key}
              key={item.key}
              newCount={item.newCount ?? 0}
              onClick={() => onSelectTop(item.key)}
            >
              {item.label}
            </AdminNavButton>
          ))}
        </div>
      </section>

      {secondaryItems?.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <AdminNavGroup
            activeKey={activeSecondaryKey}
            className="mb-0 border-b-0 pb-0"
            items={secondaryItems}
            onSelect={onSelectSecondary}
          />
        </section>
      ) : null}

      {children}
    </>
  );
}
