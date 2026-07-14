import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyAppointmentCommunicationInventory,
  evaluateAppointmentCommunicationMessage,
  mergeCarePrepAndCommunicationItems,
  normalizeAppointmentCommunicationInventory,
  rebuildAppointmentCommunicationSummary,
} from "./communicationSummary";

const baseMessage = {
  body: "",
  createdAt: "2026-07-13T12:00:00.000Z",
  from: "Andrew",
  id: "message-1",
  senderRole: "dashboard",
  to: "Rob Robson",
  transcript: "",
};

describe("appointment communication summaries", () => {
  it("adds a substantive appointment message to the Bring category", () => {
    const result = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      currentInventory: emptyAppointmentCommunicationInventory(),
      message: { ...baseMessage, body: "Bring insulin." },
      now: "2026-07-13T12:01:00.000Z",
    });

    assert.equal(result.action, "UPDATED");
    assert.equal(result.inventory.items[0]?.category, "bring_list");
    assert.equal(result.inventory.items[0]?.text, "Bring insulin.");
    assert.deepEqual(result.inventory.items[0]?.sourceMessageIds, ["message-1"]);
    assert.deepEqual(result.inventory.items[0]?.sourceDisplayNames, ["Rob"]);
  });

  it("returns NO_CHANGE for trivial acknowledgement messages", () => {
    for (const body of ["OK", "Thanks", "Got it", "👍"]) {
      const result = evaluateAppointmentCommunicationMessage({
        appointmentId: "appointment-1",
        message: { ...baseMessage, body },
      });

      assert.equal(result.action, "NO_CHANGE");
      assert.equal(result.inventory.items.length, 0);
    }
  });

  it("refines a related item without duplicating the old bullet", () => {
    const first = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      message: { ...baseMessage, body: "Bring insurance card." },
    });
    const second = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      currentInventory: first.inventory,
      message: {
        ...baseMessage,
        body: "Bring insurance card and photo ID.",
        id: "message-2",
      },
    });

    assert.equal(second.action, "UPDATED");
    assert.equal(second.inventory.items.length, 1);
    assert.match(second.inventory.items[0]?.text ?? "", /photo ID/i);
    assert.deepEqual(second.inventory.items[0]?.sourceMessageIds, [
      "message-1",
      "message-2",
    ]);
  });

  it("keeps repeated appointment message prep brief", () => {
    const first = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      message: { ...baseMessage, body: "Bring your Rx sunglasses this time" },
    });
    const second = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      currentInventory: first.inventory,
      message: {
        ...baseMessage,
        body: "Bring your pairs of glasses and sunglasses",
        id: "message-2",
      },
    });

    assert.equal(second.action, "UPDATED");
    assert.equal(second.inventory.items.length, 1);
    assert.equal(
      second.inventory.items[0]?.text,
      "Bring prescription glasses and sunglasses."
    );
  });

  it("is idempotent when the same message is evaluated twice", () => {
    const first = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      message: { ...baseMessage, body: "Bring insulin." },
    });
    const second = evaluateAppointmentCommunicationMessage({
      appointmentId: "appointment-1",
      currentInventory: first.inventory,
      message: { ...baseMessage, body: "Bring insulin." },
    });

    assert.equal(second.action, "NO_CHANGE");
    assert.equal(second.inventory.items.length, 1);
  });

  it("rejects malformed inventory items during normalization", () => {
    const inventory = normalizeAppointmentCommunicationInventory({
      items: [
        { id: "good", category: "bring_list", text: "Bring ID.", sourceMessageIds: ["m1"] },
        { id: "bad-category", category: "random", text: "Nope.", sourceMessageIds: ["m1"] },
        { id: "empty", category: "bring_list", text: "", sourceMessageIds: ["m1"] },
      ],
    });

    assert.deepEqual(inventory.items.map((item) => item.id), ["good"]);
  });

  it("merges duplicate communication and CarePrep display items conservatively", () => {
    const display = mergeCarePrepAndCommunicationItems(["Bring medication list."], [
      {
        category: "bring_list",
        createdAt: "2026-07-13T12:00:00.000Z",
        id: "bring-current-medication-list",
        sourceMessageIds: ["message-1"],
        sourceType: "communication",
        status: "active",
        text: "Bring the current medication list.",
        updatedAt: "2026-07-13T12:00:00.000Z",
      },
    ]);

    assert.equal(display.length, 1);
    assert.deepEqual(display[0]?.sourceTypes, ["careprep", "communication"]);
  });

  it("rebuilds from historical appointment-linked messages", async () => {
    const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
    const supabase = {
      from(table: string) {
        calls.push({ table, op: "from" });
        if (table === "connect_messages") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return Promise.resolve({
                data: [
                  {
                    appointment_id: "appointment-1",
                    body: "Bring insulin.",
                    created_at: "2026-07-13T12:00:00.000Z",
                    id: "message-1",
                    main_connect_user_person_id: "person-1",
                    transcript: "",
                  },
                  {
                    appointment_id: "appointment-1",
                    body: "OK",
                    created_at: "2026-07-13T12:01:00.000Z",
                    id: "message-2",
                    main_connect_user_person_id: "person-1",
                    transcript: "",
                  },
                ],
                error: null,
              });
            },
          };
        }
        return {
          upsert(payload: unknown) {
            calls.push({ table, op: "upsert", payload });
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: { id: "summary-1", summary_items: [] },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      },
    };

    await rebuildAppointmentCommunicationSummary(
      supabase as never,
      { careCircleId: "circle-1", mainConnectUserPersonId: "person-1" },
      "appointment-1"
    );

    const upsert = calls.find((call) => call.op === "upsert");
    assert.ok(upsert);
    assert.equal(
      (upsert?.payload as { last_processed_message_id?: string }).last_processed_message_id,
      "message-2"
    );
    assert.equal(
      (upsert?.payload as { last_substantive_message_id?: string }).last_substantive_message_id,
      "message-1"
    );
  });
});
