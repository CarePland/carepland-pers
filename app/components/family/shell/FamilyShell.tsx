"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CarePlandTopNav } from "../../shared/CarePlandTopNav";

const navItems = [
  { href: "/family", label: "Home" },
  { href: "/family/errands", label: "Errands" },
  { href: "/family/concerns", label: "Concerns" },
  { href: "/family/essentials", label: "Essentials" },
  { href: "/family/members", label: "Members" },
  { href: "/family/coverage", label: "Coverage" },
  { href: "/family/sms-simulator", label: "SMS Simulator" },
];

type FamilyShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

export function FamilyShell({ children, title, subtitle }: FamilyShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen overflow-x-clip bg-slate-50 px-3 pb-6 pt-2 text-slate-900 sm:px-4 sm:pt-4 lg:px-6 lg:py-8">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 2xl:max-w-6xl">
        <header className="sticky top-0 z-50 grid gap-2 bg-slate-50 py-1.5 sm:gap-3 sm:py-3">
          <CarePlandTopNav
            activeModule="family"
            canShowAsk
            earlyAccessLabel="EARLY ACCESS"
            focusOptions={[
              {
                id: "everyone",
                label: "Everyone",
                type: "everyone",
              },
            ]}
            focusValue="everyone"
          />
          <nav
            aria-label="Family navigation"
            className="mr-auto flex flex-wrap items-center gap-1.5 rounded-full border border-blue-100 bg-white/70 p-1 shadow-sm"
          >
            {navItems.map((item) => {
              const active =
                item.href === "/family"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-blue-50/70 hover:text-blue-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <section className="px-2 sm:px-4 lg:px-6">
          <div className="border-b border-blue-100 pb-5">
              <Link
                href="/family"
                className="text-sm font-semibold uppercase tracking-wide text-blue-700"
              >
                CarePland Family
              </Link>
              <h1 className="mt-2 text-3xl font-semibold text-blue-950">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
                  {subtitle}
                </p>
              ) : null}
          </div>
        </section>
        <section className="px-2 sm:px-4 lg:px-6">{children}</section>
      </section>
    </main>
  );
}
