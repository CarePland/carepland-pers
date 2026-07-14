import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyConnectMessagesSummary,
  filterMessagesForMainConnectUser,
  mergeConnectMessages,
  summarizeConnectMessages,
} from "./messageScoping";
import { groupMessagesByAppointment } from "../messageGrouping";
import type { ConnectMessageRecord } from "../types";

function message(
  overrides: Partial<ConnectMessageRecord> & Pick<ConnectMessageRecord, "id">
): ConnectMessageRecord {
  return {
    body: "Hello",
    createdAt: "2026-06-21T12:00:00.000Z",
    from: "Andrew",
    to: "Receiver",
    ...overrides,
  };
}

describe("Connect message scoping", () => {
  it("merges local and prototype messages with local records winning duplicates", () => {
    const merged = mergeConnectMessages(
      [
        message({
          body: "Local copy",
          createdAt: "2026-06-21T12:00:00.000Z",
          id: "same-id",
        }),
      ],
      [
        message({
          body: "Prototype copy",
          createdAt: "2026-06-21T12:01:00.000Z",
          id: "same-id",
        }),
        message({
          body: "Newer prototype",
          createdAt: "2026-06-21T12:02:00.000Z",
          id: "newer",
        }),
      ]
    );

    assert.deepEqual(
      merged.map((item) => item.id),
      ["newer", "same-id"]
    );
    assert.equal(merged.find((item) => item.id === "same-id")?.body, "Local copy");
  });

  it("deduplicates messages that lack ids by stable message fields", () => {
    const merged = mergeConnectMessages(
      [
        message({
          createdAt: "2026-06-21T12:00:00.000Z",
          from: "Andrew",
          id: "",
          to: "Bob",
        }),
      ],
      [
        message({
          createdAt: "2026-06-21T12:00:00.000Z",
          from: "Andrew",
          id: "",
          to: "Bob",
        }),
      ]
    );

    assert.equal(merged.length, 1);
  });

  it("filters messages to the selected Main Connect User", () => {
    const messages = [
      message({ id: "bob-text", mainConnectUserPersonId: "person-bob" }),
      message({ id: "alice-text", mainConnectUserPersonId: "person-alice" }),
      message({ id: "untagged" }),
    ];

    assert.deepEqual(
      filterMessagesForMainConnectUser(messages, "person-bob").map((item) => item.id),
      ["bob-text"]
    );
  });

  it("summarizes already-scoped messages", () => {
    const scopedMessages = [
      message({ audioArtifactId: "artifact-1", id: "audio-artifact" }),
      message({ audioUrl: "/api/connect/audio/media/file.webm", id: "audio-url" }),
      message({ id: "text" }),
    ];

    assert.deepEqual(
      summarizeConnectMessages({
        localMessages: scopedMessages.slice(0, 2),
        messages: scopedMessages,
        prototypeMessages: scopedMessages.slice(2),
      }),
      {
        audioMessages: 2,
        localMessages: 2,
        prototypeMessages: 1,
        total: 3,
      }
    );
  });

  it("returns a stable empty summary shape", () => {
    assert.deepEqual(emptyConnectMessagesSummary(), {
      audioMessages: 0,
      localMessages: 0,
      prototypeMessages: 0,
      total: 0,
    });
  });

  it("groups messages by appointment with general messages last", () => {
    const groups = groupMessagesByAppointment([
      message({
        appointmentId: "appointment-2",
        appointmentStartsAt: "2026-07-20T16:00:00.000Z",
        appointmentTitle: "PT Session",
        body: "Bring exercise papers",
        createdAt: "2026-07-12T11:00:00.000Z",
        id: "pt-older",
      }),
      message({
        body: "Good morning",
        createdAt: "2026-07-12T12:00:00.000Z",
        id: "general",
      }),
      message({
        appointmentId: "appointment-1",
        appointmentStartsAt: "2026-07-18T16:00:00.000Z",
        appointmentTitle: "Eye Exam",
        body: "Bring glasses",
        createdAt: "2026-07-12T10:00:00.000Z",
        id: "eye-older",
      }),
      message({
        appointmentId: "appointment-1",
        appointmentStartsAt: "2026-07-18T16:00:00.000Z",
        appointmentTitle: "Eye Exam",
        body: "Bring Rx sunglasses",
        createdAt: "2026-07-12T13:00:00.000Z",
        id: "eye-newer",
      }),
    ]);

    assert.deepEqual(
      groups.map((group) => group.label),
      ["Eye Exam", "PT Session", "General"]
    );
    assert.deepEqual(
      groups[0]?.messages.map((item) => item.id),
      ["eye-newer", "eye-older"]
    );
  });
});
