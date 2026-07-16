"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function ReceiverQrCard({
  appearance = "card",
  copyLabel = "Copy Link",
  details = "full",
  label,
  onCopy,
  qrSize = "default",
  text,
}: {
  appearance?: "card" | "open";
  copyLabel?: string;
  details?: "full" | "qrOnly";
  label: string;
  onCopy?: () => void;
  qrSize?: "default" | "large";
  text: string;
}) {
  const [qrCode, setQrCode] = useState("");
  const qrPixelSize = qrSize === "large" ? 300 : 220;

  useEffect(() => {
    let cancelled = false;
    if (!text) {
      return;
    }
    QRCode.toDataURL(text, {
      color: { dark: "#17231d", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: qrPixelSize,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrPixelSize, text]);

  const wrapperClass =
    details === "qrOnly"
      ? "grid place-items-center"
      : appearance === "open"
      ? "grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      : "grid gap-3 rounded-lg border border-[#d6e3f2] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center";
  const labelClass =
    appearance === "open"
      ? "text-lg font-black text-[#172f49]"
      : "text-sm font-black text-[#172f49]";
  const textClass =
    appearance === "open"
      ? "mt-3 break-all rounded-lg bg-[#f8fbff] px-4 py-3 text-base font-bold text-[#345d83]"
      : "mt-2 break-all rounded-md bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#345d83]";
  const buttonClass =
    appearance === "open"
      ? "mt-4 min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:opacity-55"
      : "mt-3 min-h-10 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:opacity-55";
  const imageClass =
    qrSize === "large"
      ? "h-56 w-56 rounded-lg border border-[#d6e3f2] bg-white p-2 sm:h-64 sm:w-64"
      : "h-36 w-36 rounded-md border border-[#d6e3f2] bg-white p-1";

  return (
    <div className={wrapperClass}>
      {details === "full" ? (
        <div className="min-w-0">
          <p className={labelClass}>{label}</p>
          <p className={textClass}>
            {text || "Not available"}
          </p>
          {onCopy ? (
            <button
              className={buttonClass}
              disabled={!text}
              onClick={onCopy}
              type="button"
            >
              {copyLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {text && qrCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${label} QR code`}
          className={imageClass}
          src={qrCode}
        />
      ) : null}
    </div>
  );
}
