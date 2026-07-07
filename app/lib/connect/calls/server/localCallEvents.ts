import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";

export type LocalConnectCallEvent = {
  actorRole: string;
  callId: string;
  createdAt: string;
  details: Record<string, unknown>;
  eventId: string;
  eventType: string;
  mainConnectUserPersonId: string;
};

type LocalCallEventsIndex = {
  events: LocalConnectCallEvent[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath("connect-calls", "events.json");

export async function recordLocalConnectCallEvent(
  input: {
    actorRole?: string;
    callId?: string;
    details?: Record<string, unknown>;
    eventType?: string;
    mainConnectUserPersonId?: string;
  },
  options: { indexPath?: string } = {}
) {
  const callId = String(input.callId || "").trim();
  const eventType = String(input.eventType || "").trim();
  const personId = String(input.mainConnectUserPersonId || "").trim();

  if (!callId || !eventType || !personId) return null;

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallEventsIndex(indexPath);
  const event: LocalConnectCallEvent = {
    actorRole: normalizeActorRole(input.actorRole),
    callId,
    createdAt: new Date().toISOString(),
    details: sanitizeEventDetails(input.details),
    eventId: `connect-call-event-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`,
    eventType,
    mainConnectUserPersonId: personId,
  };

  index.events = [event, ...index.events].slice(0, 1000);
  await writeLocalCallEventsIndex(index, indexPath);
  return event;
}

function normalizeActorRole(value: unknown) {
  const actorRole = String(value || "");
  return ["dashboard", "receiver", "system"].includes(actorRole) ? actorRole : "";
}

function sanitizeEventDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
}

async function readLocalCallEventsIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      LocalCallEventsIndex
    >;

    if (Array.isArray(parsed.events)) {
      return {
        events: parsed.events,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalCallEventsIndex;
    }
  } catch {
    // Start a local call event index on first write.
  }

  return {
    events: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalCallEventsIndex;
}

async function writeLocalCallEventsIndex(
  index: LocalCallEventsIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
