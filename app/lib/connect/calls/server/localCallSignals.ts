import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";

export type ConnectCallSignalSender = "dashboard" | "receiver";
export type ConnectCallSignalType = "answer" | "ice_candidate" | "media_state" | "offer";

export type ConnectCallSignal = {
  callId: string;
  createdAt: string;
  mainConnectUserPersonId: string;
  payload: Record<string, unknown>;
  sender: ConnectCallSignalSender;
  signalId: string;
  type: ConnectCallSignalType;
};

type LocalCallSignalsIndex = {
  signals: ConnectCallSignal[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath("connect-calls", "signals.json");

const signalSenders = new Set<string>(["dashboard", "receiver"]);
const signalTypes = new Set<string>(["answer", "ice_candidate", "media_state", "offer"]);
const defaultSignalMaxAgeMs = 2 * 60 * 60 * 1000;

export async function readLocalConnectCallSignals(
  options: { indexPath?: string } = {}
) {
  return readLocalCallSignalsIndex(options.indexPath ?? defaultIndexPath);
}

export async function compactLocalConnectCallSignals(
  options: {
    indexPath?: string;
    maxAgeMs?: number;
    now?: Date;
  } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallSignalsIndex(indexPath);
  const compactedSignals = compactSignals(index.signals, options);

  if (compactedSignals.length !== index.signals.length) {
    index.signals = compactedSignals;
    await writeLocalCallSignalsIndex(index, indexPath);
  }

  return {
    ...index,
    signals: compactedSignals,
  } satisfies LocalCallSignalsIndex;
}

export async function recordLocalConnectCallSignal(
  input: {
    callId?: string;
    mainConnectUserPersonId?: string;
    payload?: Record<string, unknown>;
    sender?: string;
    type?: string;
  },
  options: { indexPath?: string } = {}
) {
  const callId = String(input.callId || "").trim();
  const personId = String(input.mainConnectUserPersonId || "").trim();
  const sender = normalizeSignalSender(input.sender);
  const type = normalizeSignalType(input.type);

  if (!callId || !personId || !sender || !type) return null;

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallSignalsIndex(indexPath);
  const signal: ConnectCallSignal = {
    callId,
    createdAt: new Date().toISOString(),
    mainConnectUserPersonId: personId,
    payload: sanitizeSignalPayload(input.payload),
    sender,
    signalId: `connect-call-signal-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`,
    type,
  };

  index.signals = [signal, ...compactSignals(index.signals)].slice(0, 1000);
  await writeLocalCallSignalsIndex(index, indexPath);

  return signal;
}

export function filterLocalConnectCallSignals(
  signals: ConnectCallSignal[],
  options: {
    afterSignalId?: string;
    callId: string;
    mainConnectUserPersonId: string;
    notSender?: string;
  }
) {
  let matchingSignals = signals
    .filter((signal) => signal.callId === options.callId)
    .filter((signal) => signal.mainConnectUserPersonId === options.mainConnectUserPersonId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  if (options.afterSignalId) {
    const afterIndex = matchingSignals.findIndex(
      (signal) => signal.signalId === options.afterSignalId
    );
    matchingSignals = afterIndex >= 0 ? matchingSignals.slice(afterIndex + 1) : matchingSignals;
  }

  return matchingSignals.filter(
    (signal) => !options.notSender || signal.sender !== options.notSender
  );
}

function normalizeSignalSender(value: unknown): ConnectCallSignalSender | null {
  const sender = String(value || "");
  return signalSenders.has(sender) ? (sender as ConnectCallSignalSender) : null;
}

function normalizeSignalType(value: unknown): ConnectCallSignalType | null {
  const type = String(value || "");
  return signalTypes.has(type) ? (type as ConnectCallSignalType) : null;
}

function sanitizeSignalPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

function compactSignals(
  signals: ConnectCallSignal[],
  options: { maxAgeMs?: number; now?: Date } = {}
) {
  const maxAgeMs = options.maxAgeMs ?? defaultSignalMaxAgeMs;
  const nowMs = (options.now ?? new Date()).getTime();
  const cutoffMs = nowMs - maxAgeMs;

  return signals
    .filter((signal) => {
      const createdMs = new Date(signal.createdAt).getTime();
      return Number.isFinite(createdMs) && createdMs >= cutoffMs;
    })
    .slice(0, 1000);
}

async function readLocalCallSignalsIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      LocalCallSignalsIndex
    >;

    if (Array.isArray(parsed.signals)) {
      return {
        signals: parsed.signals,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalCallSignalsIndex;
    }
  } catch {
    // Start a local call signal index on first write.
  }

  return {
    signals: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalCallSignalsIndex;
}

async function writeLocalCallSignalsIndex(
  index: LocalCallSignalsIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
