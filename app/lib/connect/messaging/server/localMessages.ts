import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ConnectMessageRecord } from "../types";

type LocalMessagesIndex = {
  messages: ConnectMessageRecord[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = path.join(
  process.cwd(),
  "tmp",
  "connect-messages",
  "messages.json"
);

export async function readLocalConnectMessages(
  options: { indexPath?: string } = {}
) {
  return readLocalMessagesIndex(options.indexPath ?? defaultIndexPath);
}

export async function recordLocalConnectMessage(
  input: Partial<ConnectMessageRecord>,
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalMessagesIndex(indexPath);
  const createdAt = input.createdAt || new Date().toISOString();
  const message: ConnectMessageRecord = {
    audioArtifactId: input.audioArtifactId || "",
    audioDurationMs: input.audioDurationMs,
    audioMimeType: input.audioMimeType || "",
    audioUrl: input.audioUrl || "",
    body: input.body || input.transcript || "Voice message",
    createdAt,
    from: input.from || "receiver_user",
    heardAt: input.heardAt || "",
    id:
      input.id ||
      input.audioArtifactId ||
      `connect-message-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    mainConnectUserPersonId: input.mainConnectUserPersonId || "",
    messageType: input.messageType || (input.audioUrl ? "audio" : "text"),
    readAt: input.readAt || "",
    receiverId: input.receiverId || "",
    source: input.source || "connect_message",
    to: input.to || "",
    transcript: input.transcript || "",
    transcriptStatus: input.transcriptStatus || "",
  };

  index.messages = [
    message,
    ...index.messages.filter((item) => item.id !== message.id),
  ];
  await writeLocalMessagesIndex(index, indexPath);

  return message;
}

export async function updateLocalConnectMessageState(
  messageId: string,
  state: "heard" | "read",
  options: { indexPath?: string; mainConnectUserPersonId?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalMessagesIndex(indexPath);
  const now = new Date().toISOString();
  let updated: ConnectMessageRecord | null = null;

  index.messages = index.messages.map((message) => {
    if (message.id !== messageId) return message;
    if (
      options.mainConnectUserPersonId &&
      message.mainConnectUserPersonId !== options.mainConnectUserPersonId
    ) {
      return message;
    }

    updated = {
      ...message,
      heardAt: state === "heard" ? now : message.heardAt,
      readAt: state === "read" ? now : message.readAt,
    };
    return updated;
  });

  if (updated) {
    await writeLocalMessagesIndex(index, indexPath);
  }

  return updated;
}

async function readLocalMessagesIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      LocalMessagesIndex
    >;

    if (Array.isArray(parsed.messages)) {
      return {
        messages: parsed.messages,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalMessagesIndex;
    }
  } catch {
    // Start a local message index on first write.
  }

  return {
    messages: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalMessagesIndex;
}

async function writeLocalMessagesIndex(index: LocalMessagesIndex, indexPath: string) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
