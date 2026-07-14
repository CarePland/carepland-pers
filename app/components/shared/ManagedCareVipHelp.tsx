"use client";

import { useEffect, useRef, useState } from "react";

const managedCareVipTooltipText =
  "This Care VIP will not log in to CarePland directly. If configured, they can still use Receiver. This is useful for children, pets, and others who won't be personally logging into CarePland.";

export function ManagedCareVipHelp({
  tooltipId = "managed-care-vip-help",
}: {
  tooltipId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span
      className="relative inline-flex overflow-visible align-middle"
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setIsOpen(false);
        }
      }}
      onFocus={() => setIsOpen(true)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      ref={containerRef}
    >
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label="About Managed Care VIP"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold leading-none text-slate-500 transition hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        ?
      </button>
      {isOpen ? (
        <span
          className="absolute left-0 top-full z-[80] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-blue-100 bg-white p-3 text-sm font-normal leading-5 text-slate-700 shadow-lg"
          id={tooltipId}
          role="tooltip"
        >
          {managedCareVipTooltipText}
        </span>
      ) : null}
    </span>
  );
}
