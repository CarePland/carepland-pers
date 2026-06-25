"use client";

const pageViewStatePrefix = "carepland-page-view-state:";

function storageKey(pageKey: string) {
  return `${pageViewStatePrefix}${pageKey}`;
}

export type PageViewStateRecord<TState extends object> = TState & {
  engaged: boolean;
  updatedAt: string;
};

export function savePageViewState<TState extends object>(
  pageKey: string,
  state: TState & { engaged?: boolean }
) {
  if (typeof window === "undefined") return;

  const record: PageViewStateRecord<TState> = {
    ...state,
    engaged: state.engaged ?? true,
    updatedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(storageKey(pageKey), JSON.stringify(record));
}

export function restorePageViewState<TState extends object>(
  pageKey: string
): PageViewStateRecord<TState> | null {
  if (typeof window === "undefined") return null;

  const rawState = window.sessionStorage.getItem(storageKey(pageKey));
  if (!rawState) return null;

  try {
    return JSON.parse(rawState) as PageViewStateRecord<TState>;
  } catch {
    window.sessionStorage.removeItem(storageKey(pageKey));
    return null;
  }
}

export function clearPageViewState(pageKey: string) {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(storageKey(pageKey));
}

export function clearAllPageViewState() {
  if (typeof window === "undefined") return;

  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith(pageViewStatePrefix))
    .forEach((key) => window.sessionStorage.removeItem(key));
}
