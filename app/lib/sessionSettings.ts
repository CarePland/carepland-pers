export type AppSessionSettings = {
  admin_idle_timeout_hours: number | null;
  settings_key: string;
  updated_at: string | null;
  user_idle_timeout_hours: number | null;
};

export const defaultAppSessionSettings: AppSessionSettings = {
  admin_idle_timeout_hours: null,
  settings_key: "default",
  updated_at: null,
  user_idle_timeout_hours: 24,
};

export function normalizeIdleTimeoutHours(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(numericValue);
}

export function normalizeAppSessionSettings(
  value: Partial<AppSessionSettings> | null | undefined
): AppSessionSettings {
  return {
    ...defaultAppSessionSettings,
    ...value,
    admin_idle_timeout_hours: normalizeIdleTimeoutHours(
      value?.admin_idle_timeout_hours
    ),
    user_idle_timeout_hours: normalizeIdleTimeoutHours(
      value?.user_idle_timeout_hours
    ),
  };
}

export function sessionIdleTimeoutHours(
  settings: AppSessionSettings,
  isAdmin: boolean
) {
  return isAdmin
    ? settings.admin_idle_timeout_hours
    : settings.user_idle_timeout_hours;
}
