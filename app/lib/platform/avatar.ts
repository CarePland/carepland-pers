export type AvatarPerson = {
  avatarAltText?: string | null;
  avatarEmoji?: string | null;
  avatarType?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
};

export function avatarInitials(displayName?: string | null) {
  const normalizedName = String(displayName || "").trim();

  if (!normalizedName) {
    return "CP";
  }

  const words = normalizedName
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (words.length === 0) {
    return normalizedName.slice(0, 2).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function avatarAltText(person: AvatarPerson) {
  const explicitAltText = String(person.avatarAltText || "").trim();

  if (explicitAltText) {
    return explicitAltText;
  }

  const displayName = String(person.displayName || "").trim();

  return displayName ? `${displayName} avatar` : "CarePland person avatar";
}
