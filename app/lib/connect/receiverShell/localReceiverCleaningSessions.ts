import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createSupabaseServiceClient } from "../../platform/server/supabase";
import { careplandRuntimeTempPath } from "../../platform/server/runtimeTemp";

export type ReceiverCleaningSession = {
  cleaningCount: number | null;
  cleaningCompletedAt: string;
  cleaningStartedAt: string;
  createdAt: string;
  deviceIdentifier: string;
  duration: number | null;
  mainConnectUserPersonId: string;
  message: string;
  receiverDeviceId: string;
  receiverId: string;
  receiverInstallId: string;
  receiverMode: "Dedicated" | "Personal";
  sessionId: string;
  updatedAt: string;
};

export type ReceiverCleaningSessionInput = {
  cleaningCount?: number;
  cleaningCompletedAt?: string;
  cleaningStartedAt?: string;
  deviceIdentifier?: string;
  duration?: number;
  mainConnectUserPersonId?: string;
  message?: string;
  receiverDeviceId?: string;
  receiverId?: string;
  receiverInstallId?: string;
  receiverMode?: string;
  sessionId?: string;
};

type ReceiverCleaningSessionIndex = {
  sessions: ReceiverCleaningSession[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath(
  "connect-receiver",
  "screen-cleaning-sessions.json"
);

export async function readLocalReceiverCleaningSessions(
  options: { indexPath?: string } = {}
) {
  return readLocalReceiverCleaningSessionIndex(options.indexPath ?? defaultIndexPath);
}

export async function recordLocalReceiverCleaningSession(
  input: ReceiverCleaningSessionInput,
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalReceiverCleaningSessionIndex(indexPath);
  const sessionId =
    cleanText(input.sessionId, 120) ||
    `screen-cleaning-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const existingIndex = index.sessions.findIndex(
    (session) => session.sessionId === sessionId
  );
  const existing = existingIndex >= 0 ? index.sessions[existingIndex] : null;
  const session = buildReceiverCleaningSession(input, existing, sessionId);

  if (existingIndex >= 0) {
    index.sessions.splice(existingIndex, 1);
  }
  index.sessions = [session, ...index.sessions].slice(0, 1000);
  await writeLocalReceiverCleaningSessionIndex(index, indexPath);

  return session;
}

export async function recordSupabaseReceiverCleaningSession(
  input: ReceiverCleaningSessionInput
) {
  const sessionId =
    cleanText(input.sessionId, 120) ||
    `screen-cleaning-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const normalized = buildReceiverCleaningSession(input, null, sessionId);
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("connect_receiver_cleaning_sessions").upsert({
    cleaning_completed_at: normalized.cleaningCompletedAt || null,
    cleaning_count: normalized.cleaningCount,
    cleaning_started_at: normalized.cleaningStartedAt,
    device_identifier: normalized.deviceIdentifier,
    duration_seconds: normalized.duration,
    main_connect_user_person_id: uuidOrNull(normalized.mainConnectUserPersonId),
    message: normalized.message,
    receiver_device_id: normalized.receiverDeviceId || null,
    receiver_id: normalized.receiverId,
    receiver_install_id: normalized.receiverInstallId,
    receiver_mode: normalized.receiverMode,
    session_id: normalized.sessionId,
    updated_at: normalized.updatedAt,
  });

  if (error) throw error;
  return normalized;
}

function buildReceiverCleaningSession(
  input: ReceiverCleaningSessionInput,
  existing: ReceiverCleaningSession | null,
  sessionId: string
): ReceiverCleaningSession {
  const now = new Date().toISOString();
  const cleaningStartedAt =
    cleanTimestamp(input.cleaningStartedAt) || existing?.cleaningStartedAt || now;
  const cleaningCompletedAt =
    cleanTimestamp(input.cleaningCompletedAt) || existing?.cleaningCompletedAt || "";
  const duration =
    finiteDuration(input.duration) ??
    (cleaningCompletedAt
      ? durationSeconds(cleaningStartedAt, cleaningCompletedAt)
      : existing?.duration ?? null);

  return {
    cleaningCount: finitePositiveInteger(input.cleaningCount) ?? existing?.cleaningCount ?? null,
    cleaningCompletedAt,
    cleaningStartedAt,
    createdAt: existing?.createdAt || now,
    deviceIdentifier:
      cleanText(input.deviceIdentifier, 160) ||
      cleanText(input.receiverDeviceId, 160) ||
      cleanText(input.receiverInstallId, 160) ||
      existing?.deviceIdentifier ||
      "",
    duration,
    mainConnectUserPersonId:
      cleanText(input.mainConnectUserPersonId, 120) ||
      existing?.mainConnectUserPersonId ||
      "",
    message: cleanMessage(input.message) || existing?.message || "",
    receiverDeviceId:
      cleanText(input.receiverDeviceId, 160) || existing?.receiverDeviceId || "",
    receiverId: cleanText(input.receiverId, 160) || existing?.receiverId || "",
    receiverInstallId:
      cleanText(input.receiverInstallId, 160) || existing?.receiverInstallId || "",
    receiverMode: normalizeReceiverMode(input.receiverMode || existing?.receiverMode),
    sessionId,
    updatedAt: now,
  };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function cleanMessage(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 500);
}

function cleanTimestamp(value: unknown) {
  const text = cleanText(value, 80);
  if (!text) return "";
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function finiteDuration(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0
    ? Math.round(numberValue)
    : undefined;
}

function finitePositiveInteger(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : undefined;
}

function durationSeconds(startedAt: string, completedAt: string) {
  const startedMs = Date.parse(startedAt);
  const completedMs = Date.parse(completedAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(completedMs)) return null;
  return Math.max(0, Math.round((completedMs - startedMs) / 1000));
}

function normalizeReceiverMode(value: unknown): ReceiverCleaningSession["receiverMode"] {
  return String(value || "").trim().toLowerCase() === "personal"
    ? "Personal"
    : "Dedicated";
}

function uuidOrNull(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

async function readLocalReceiverCleaningSessionIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      ReceiverCleaningSessionIndex
    >;

    if (Array.isArray(parsed.sessions)) {
      return {
        sessions: parsed.sessions,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies ReceiverCleaningSessionIndex;
    }
  } catch {
    // Start a local cleaning-session index on first write.
  }

  return {
    sessions: [],
    updatedAt: "",
    version: 1,
  } satisfies ReceiverCleaningSessionIndex;
}

async function writeLocalReceiverCleaningSessionIndex(
  index: ReceiverCleaningSessionIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
