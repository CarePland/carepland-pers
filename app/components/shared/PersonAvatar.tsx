"use client";

import Image from "next/image";

import {
  avatarAltText,
  avatarInitials,
  type AvatarPerson,
} from "../../lib/platform/avatar";

type PersonAvatarProps = {
  className?: string;
  person?: AvatarPerson | null;
  selected?: boolean;
  size?: "lg" | "md" | "sm" | "xs";
};

const sizeClasses = {
  lg: "h-20 w-20 text-3xl",
  md: "h-10 w-10 text-sm",
  sm: "h-7 w-7 text-[10px]",
  xs: "h-6 w-6 text-[9px]",
};

const imageSizes = {
  lg: "80px",
  md: "40px",
  sm: "28px",
  xs: "24px",
};

const emojiClasses = {
  lg: "text-5xl leading-none",
  md: "text-3xl leading-none",
  sm: "text-xl leading-none",
  xs: "text-base leading-none",
};

export function PersonAvatar({
  className = "",
  person,
  selected = false,
  size = "md",
}: PersonAvatarProps) {
  const avatarUrl = person?.avatarUrl?.trim();
  const avatarEmoji = person?.avatarEmoji?.trim();
  const displayName = person?.displayName ?? "";
  const altText = avatarAltText({
    avatarAltText: person?.avatarAltText,
    displayName,
  });

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-bold shadow-sm ${
        selected
          ? "border-white/80 bg-white/15 text-white"
          : "border-blue-100 bg-blue-50 text-blue-700"
      } ${sizeClasses[size]} ${className}`}
      title={displayName || altText}
    >
      {avatarUrl ? (
        <Image
          alt={altText}
          className="h-full w-full object-cover"
          fill
          sizes={imageSizes[size]}
          src={avatarUrl}
          unoptimized
        />
      ) : avatarEmoji ? (
        <span aria-hidden="true" className={emojiClasses[size]}>
          {avatarEmoji}
        </span>
      ) : (
        <span aria-hidden="true">{avatarInitials(displayName)}</span>
      )}
    </span>
  );
}

export function PersonChip({
  className = "",
  labelPrefix = "for",
  person,
  size = "sm",
}: {
  className?: string;
  labelPrefix?: string;
  person?: AvatarPerson | null;
  size?: "sm" | "xs";
}) {
  const displayName = person?.displayName?.trim();

  if (!displayName) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-[#767676] ${className}`}
    >
      <span>{labelPrefix} {displayName}</span>
      <PersonAvatar person={person} size={size} />
    </span>
  );
}
