"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  getPlatformModuleVisibility,
  platformModuleVisibilityOverrideChangedEvent,
  readShowAllPlatformModulesOverride,
} from "../../lib/platform/moduleAccess";
import { ManagedByHouseholdHeart, PersonAvatar } from "./PersonAvatar";
import type { AvatarPerson } from "../../lib/platform/avatar";

export type CarePlandTopNavModule =
  | "appointments"
  | "connect"
  | "family"
  | "profile"
  | "admin";

type SupportMetric = {
  count: number;
  label: string;
  tone?: "neutral" | "attention" | "urgent";
};

export type CarePlandFocusOption = {
  avatar?: AvatarPerson | null;
  id: string;
  label: string;
  type: "everyone" | "person";
};

type CarePlandTopNavProps = {
  activeModule?: CarePlandTopNavModule;
  adminHref?: string;
  accountEmail?: string | null;
  askActive?: boolean;
  askHref?: string;
  canShowAdmin?: boolean;
  canShowAsk?: boolean;
  className?: string;
  earlyAccessLabel?: string;
  environmentLabel?: string;
  focusOptions?: CarePlandFocusOption[];
  focusValue?: string;
  homeHref?: string;
  onAdminClick?: () => void | Promise<void>;
  onAppointmentsClick?: () => void | Promise<void>;
  onAskClick?: () => void;
  onChangeFocus?: (focusId: string) => void;
  onHomeClick?: () => void | Promise<void>;
  onProfileClick?: () => void | Promise<void>;
  onSignOut?: () => void;
  planTierId?: string;
  primaryAction?: ReactNode;
  supportMetrics?: SupportMetric[];
};

const basePillClass =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-semibold leading-none shadow-sm transition sm:h-11 sm:px-4";

function navPillClass(active: boolean) {
  return `${basePillClass} ${
    active
      ? "border-blue-300 bg-blue-50 text-blue-800 ring-1 ring-blue-200"
      : "border-slate-200 bg-white/85 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
  }`;
}

function askPillClass(active: boolean, speechBubble = false) {
  if (speechBubble) {
    return `inline-flex h-10 w-20 shrink-0 items-center justify-center rounded-none transition sm:h-11 sm:w-24 ${
      active ? "opacity-100" : "opacity-95 hover:opacity-100"
    }`;
  }

  return `${basePillClass} ${
    active
      ? "border-blue-200 bg-blue-100 text-[#2B6198]"
      : "border-blue-100 bg-blue-50 text-[#2B6198] hover:border-blue-200 hover:bg-blue-100"
  }`;
}

function metricClass(tone: SupportMetric["tone"] = "neutral") {
  if (tone === "urgent") return "bg-red-50 text-red-700";
  if (tone === "attention") return "bg-amber-50 text-amber-800";
  return "bg-slate-50 text-slate-500";
}

function AskSpeechBubbleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-full w-full drop-shadow-sm"
      fill="none"
      viewBox="0 0 140 92"
    >
      <path
        d="M27 5h76c18 0 32 14 32 32s-14 32-32 32H56L34 86V69h-7C14.3 69 4 58.7 4 46V28C4 15.3 14.3 5 27 5Z"
        fill="white"
        stroke="#2B6198"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <text
        fill="#2B6198"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="34"
        fontWeight="700"
        x="36"
        y="48"
      >
        Ask
      </text>
    </svg>
  );
}

function firstNameLabel(value?: string | null) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const firstToken = normalizedValue.split(/\s+/)[0] || "";
  const emailLocalPart = firstToken.includes("@")
    ? firstToken.split("@")[0]
    : firstToken;
  const firstNameishPart = emailLocalPart.split(/[._-]/)[0] || emailLocalPart;

  return firstNameishPart
    ? firstNameishPart[0].toUpperCase() + firstNameishPart.slice(1)
    : "";
}

function NavLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: string;
  href: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!href.startsWith("/?personal=1")) {
      return;
    }

    event.preventDefault();
    window.location.assign(href);
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={navPillClass(active)}
      href={href}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

function NavActionLink({
  active,
  children,
  href,
  onClick,
}: {
  active: boolean;
  children: string;
  href: string;
  onClick: () => void | Promise<void>;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    void onClick();
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={navPillClass(active)}
      href={href}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

function UtilityActionLink({
  ariaExpanded,
  ariaLabel,
  children,
  className,
  href,
  onClick,
  testId,
  title,
}: {
  ariaExpanded?: boolean;
  ariaLabel: string;
  children: ReactNode;
  className: string;
  href: string;
  onClick: () => void;
  testId?: string;
  title?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onClick();
  }

  return (
    <Link
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      className={className}
      data-testid={testId}
      href={href}
      onClick={handleClick}
      title={title}
    >
      {children}
    </Link>
  );
}

export function CarePlandTopNav({
  activeModule,
  adminHref = "/admin",
  accountEmail,
  askActive = false,
  askHref = "/?personal=1&ask=1",
  canShowAdmin = false,
  canShowAsk = true,
  className = "",
  earlyAccessLabel,
  environmentLabel,
  focusOptions = [],
  focusValue,
  homeHref = "/?personal=1",
  onAdminClick,
  onAppointmentsClick,
  onAskClick,
  onChangeFocus,
  onHomeClick,
  onProfileClick,
  onSignOut,
  planTierId,
  primaryAction,
  supportMetrics = [],
}: CarePlandTopNavProps) {
  const [showAllPlatformModules, setShowAllPlatformModules] = useState(false);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);
  const focusMenuRef = useRef<HTMLDivElement | null>(null);
  const moduleVisibility = useMemo(
    () =>
      getPlatformModuleVisibility({
        planTierId,
        showAllOverride: showAllPlatformModules,
      }),
    [planTierId, showAllPlatformModules]
  );
  const useAskSpeechBubble =
    activeModule === "appointments" || activeModule === "connect";

  useEffect(() => {
    function syncShowAllPlatformModules() {
      setShowAllPlatformModules(readShowAllPlatformModulesOverride());
    }

    syncShowAllPlatformModules();
    window.addEventListener(
      platformModuleVisibilityOverrideChangedEvent,
      syncShowAllPlatformModules
    );
    window.addEventListener("storage", syncShowAllPlatformModules);

    return () => {
      window.removeEventListener(
        platformModuleVisibilityOverrideChangedEvent,
        syncShowAllPlatformModules
      );
      window.removeEventListener("storage", syncShowAllPlatformModules);
    };
  }, []);

  useEffect(() => {
    if (!focusMenuOpen) {
      return;
    }

    function closeFocusMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && focusMenuRef.current?.contains(target)) {
        return;
      }

      setFocusMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeFocusMenuOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", closeFocusMenuOnOutsideClick);
    };
  }, [focusMenuOpen]);

  const currentFocus =
    focusOptions.find((option) => option.id === focusValue) ??
    focusOptions[0] ??
    null;
  const currentFocusLabel =
    currentFocus?.type === "person"
      ? firstNameLabel(currentFocus.label) || currentFocus.label
      : currentFocus?.label ?? "Everyone";
  const currentFocusAvatar =
    currentFocus?.type === "person"
      ? currentFocus.avatar ?? { displayName: currentFocus.label }
      : null;

  const homeControl = (
    <span className="inline-flex items-center gap-2 rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-300">
      <Image
        alt="CarePland"
        className="h-auto w-9 shrink-0 min-[390px]:w-10 sm:w-12"
        height={460}
        priority
        src="/carepland-loop-mark.png"
        width={460}
      />
    </span>
  );

  return (
    <div
      className={`grid w-full grid-cols-[max-content_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[max-content_minmax(0,1fr)_minmax(12rem,14rem)] ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {onHomeClick ? (
          <Link
            aria-label="CarePland home"
            className="shrink-0 rounded-md"
            href={homeHref}
            onClick={(event) => {
              event.preventDefault();
              void onHomeClick();
            }}
          >
            {homeControl}
          </Link>
        ) : (
          <Link aria-label="CarePland home" className="shrink-0 rounded-md" href={homeHref}>
            {homeControl}
          </Link>
        )}
        {environmentLabel ? (
          <span
            className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900"
            title="Non-production environment"
          >
            {environmentLabel}
          </span>
        ) : null}
        {earlyAccessLabel ? (
          <span className="inline-flex h-5 items-center rounded-full border border-blue-100 bg-blue-50/70 px-2 text-[9px] font-bold uppercase tracking-wide text-blue-500">
            {earlyAccessLabel}
          </span>
        ) : null}
      </div>

      <nav
        aria-label="CarePland navigation"
        className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2"
      >
        {onAppointmentsClick ? (
          <NavActionLink
            active={activeModule === "appointments"}
            href="/?personal=1&appointments=1&view=upcoming"
            onClick={onAppointmentsClick}
          >
            Appointments
          </NavActionLink>
        ) : (
          <NavLink
            active={activeModule === "appointments"}
            href="/?personal=1&appointments=1&view=upcoming"
          >
            Appointments
          </NavLink>
        )}
        {moduleVisibility.connect ? (
          <NavLink active={activeModule === "connect"} href="/connect/dashboard">
            Connect
          </NavLink>
        ) : null}
        {primaryAction}
        {moduleVisibility.family ? (
          <NavLink active={activeModule === "family"} href="/family">
            Family
          </NavLink>
        ) : null}
      </nav>

      <div className="col-span-2 flex min-w-0 items-center justify-end gap-1.5 text-sm text-slate-600 sm:col-span-1 sm:gap-2">
        {currentFocus ? (
          <div className="relative" ref={focusMenuRef}>
            <button
              aria-expanded={focusMenuOpen}
              aria-haspopup="menu"
              className="inline-flex min-w-0 max-w-44 items-center gap-2 rounded-full py-1 pl-1 pr-2 text-slate-900 transition hover:bg-blue-50/60 md:max-w-52"
              onClick={() => setFocusMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {currentFocus.type === "everyone" ? (
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-sm">
                  👥
                </span>
              ) : (
                <PersonAvatar person={currentFocusAvatar} size="sm" />
              )}
              <span className="min-w-0 truncate font-semibold">
                {currentFocus.type === "everyone" ? "Everyone" : currentFocusLabel}
              </span>
              {currentFocusAvatar?.managedByHousehold ? (
                <ManagedByHouseholdHeart className="text-lg" />
              ) : null}
            </button>
            {focusMenuOpen ? (
              <div
                className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 text-left shadow-lg"
                role="menu"
              >
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Viewing
                </div>
                <div className="space-y-0.5 px-2">
                  {focusOptions.map((option) => {
                    const selected = option.id === currentFocus.id;
                    const label =
                      option.type === "person"
                        ? firstNameLabel(option.label) || option.label
                        : "Everyone";

                    return (
                      <button
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold transition ${
                          selected
                            ? "bg-blue-50 text-blue-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        data-selected={selected ? "true" : undefined}
                        key={option.id}
                        onClick={() => {
                          onChangeFocus?.(option.id);
                          setFocusMenuOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {option.type === "everyone" ? (
                          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-sm">
                            👥
                          </span>
                        ) : (
                          <PersonAvatar
                            person={option.avatar ?? { displayName: option.label }}
                            size="sm"
                          />
                        )}
                        <span className="min-w-0 truncate">{label}</span>
                        {option.avatar?.managedByHousehold ? (
                          <ManagedByHouseholdHeart className="text-lg" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {onProfileClick || accountEmail || onSignOut ? (
                  <>
                    <div className="my-2 h-px bg-slate-100" />
                    <div className="space-y-0.5 px-2">
                      {onProfileClick || accountEmail ? (
                        <button
                          className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          disabled={!onProfileClick}
                          onClick={() => {
                            setFocusMenuOpen(false);
                            void onProfileClick?.();
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <span>Profile & Settings</span>
                          {accountEmail ? (
                            <span className="mt-0.5 max-w-full truncate text-xs font-medium text-slate-400">
                              {accountEmail}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                      {onSignOut ? (
                    <button
                      className="flex w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        setFocusMenuOpen(false);
                        onSignOut();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      Sign Out
                    </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {supportMetrics.length ? (
          canShowAdmin ? (
            onAdminClick ? (
              <UtilityActionLink
                ariaLabel="Open Admin"
                className="hidden min-w-[3.75rem] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white text-xs font-semibold shadow-sm transition hover:border-blue-200 hover:bg-blue-50 min-[430px]:inline-flex"
                href={adminHref}
                onClick={onAdminClick}
                title="Open Admin"
              >
                {supportMetrics.map((metric, index) => (
                  <span className="inline-flex items-center" key={metric.label}>
                    {index > 0 ? (
                      <span aria-hidden="true" className="px-1 text-slate-300">
                        /
                      </span>
                    ) : null}
                    <span className={`px-2.5 py-1 ${metricClass(metric.tone)}`}>
                      {metric.count}
                      <span className="sr-only"> {metric.label}</span>
                    </span>
                  </span>
                ))}
              </UtilityActionLink>
            ) : (
              <Link
                aria-label="Open Admin"
                className="hidden min-w-[3.75rem] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white text-xs font-semibold shadow-sm transition hover:border-blue-200 hover:bg-blue-50 min-[430px]:inline-flex"
                href={adminHref}
                title="Open Admin"
              >
                {supportMetrics.map((metric, index) => (
                  <span className="inline-flex items-center" key={metric.label}>
                    {index > 0 ? (
                      <span aria-hidden="true" className="px-1 text-slate-300">
                        /
                      </span>
                    ) : null}
                    <span className={`px-2.5 py-1 ${metricClass(metric.tone)}`}>
                      {metric.count}
                      <span className="sr-only"> {metric.label}</span>
                    </span>
                  </span>
                ))}
              </Link>
            )
          ) : (
            <span className="hidden min-w-[3.75rem] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white text-xs font-semibold shadow-sm min-[430px]:inline-flex">
              {supportMetrics.map((metric, index) => (
                <span className="inline-flex items-center" key={metric.label}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="px-1 text-slate-300">
                      /
                    </span>
                  ) : null}
                  <span className={`px-2.5 py-1 ${metricClass(metric.tone)}`}>
                    {metric.count}
                    <span className="sr-only"> {metric.label}</span>
                  </span>
                </span>
              ))}
            </span>
          )
        ) : null}
        {canShowAsk ? (
          onAskClick ? (
            <UtilityActionLink
              ariaExpanded={askActive}
              ariaLabel="Ask CarePland"
              className={askPillClass(askActive, useAskSpeechBubble)}
              href={askHref}
              onClick={onAskClick}
              testId="ask-entry"
              title="Ask CarePland"
            >
              {useAskSpeechBubble ? <AskSpeechBubbleIcon /> : "Ask"}
            </UtilityActionLink>
          ) : (
            <Link
              aria-label="Ask CarePland"
              className={askPillClass(false, useAskSpeechBubble)}
              href={askHref}
            >
              {useAskSpeechBubble ? <AskSpeechBubbleIcon /> : "Ask"}
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
