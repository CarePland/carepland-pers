import type { ReactNode } from "react";

export function ReceiverSetupStatus({
  align = "left",
  children,
  size = "default",
  tone = "info",
}: {
  align?: "center" | "left";
  children: ReactNode;
  size?: "default" | "large";
  tone?: "good" | "info" | "warn" | "error";
}) {
  const sizeClass = size === "large" ? "text-lg" : "text-sm";
  const alignClass = align === "center" ? "text-center" : "text-left";

  if (tone === "warn") {
    return (
      <p className={`px-1 py-2 ${alignClass} ${sizeClass} font-bold leading-snug text-[#6f4d00]`}>
        {children}
      </p>
    );
  }

  const toneClass =
    tone === "good"
      ? "border-[#b7e2c8] bg-[#e5f7ee] text-[#176342]"
      : tone === "error"
          ? "border-[#f0b7b2] bg-[#fff1f0] text-[#8f241e]"
          : "border-[#d6e3f2] bg-[#f8fbff] text-[#345d83]";

  return (
    <p className={`rounded-lg border px-4 py-3 ${alignClass} ${sizeClass} font-bold leading-snug ${toneClass}`}>
      {children}
    </p>
  );
}
