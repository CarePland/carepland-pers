export const allCarePlandFocusValue = "all";
export const carePlandUiStateStorageKey = "carepland-ui-state:v1";

type StoredCarePlandUiState = {
  selectedSubjectId?: string;
};

function readStoredJson<T>(storage: Storage, key: string): T | null {
  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeStoredJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

export function readCarePlandFocusId(storage: Storage) {
  return (
    readStoredJson<StoredCarePlandUiState>(
      storage,
      carePlandUiStateStorageKey
    )?.selectedSubjectId ?? allCarePlandFocusValue
  );
}

export function writeCarePlandFocusId(storage: Storage, focusId: string) {
  const existingState =
    readStoredJson<Record<string, unknown>>(storage, carePlandUiStateStorageKey) ??
    {};

  writeStoredJson(storage, carePlandUiStateStorageKey, {
    ...existingState,
    selectedSubjectId: focusId || allCarePlandFocusValue,
  });
}
