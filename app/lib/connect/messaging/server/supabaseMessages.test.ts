import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectMessageInsertFromInput,
  connectMessageRecordFromRow,
  connectMessageStateUpdate,
} from "./supabaseMessages";

describe("Supabase Connect messages", () => {
  it("builds dashboard message inserts with acknowledgement and callback options", () => {
    const insert = connectMessageInsertFromInput(
      {
        allowsCallbackRequest: true,
        appointmentId: "appointment-1",
        body: "Lunch is in the fridge.",
        clientMessageId: "coordinator-text-1",
        from: "Andrew",
        mainConnectUserPersonId: "person-bob",
        requiresAcknowledgement: true,
        source: "coordinator_text_message",
        to: "Bob",
      },
      {
        accessType: "user",
        careCircleId: "care-circle-1",
        createdByUserId: "user-1",
        mainConnectUserPersonId: "person-bob",
        receiverDeviceId: "receiver-2",
        supabase: {} as never,
      }
    );

    assert.equal(insert.allows_callback_request, true);
    assert.equal(insert.appointment_id, "appointment-1");
    assert.equal(insert.requires_acknowledgement, true);
    assert.equal(insert.main_connect_user_person_id, "person-bob");
    assert.equal(insert.receiver_device_id, null);
    assert.deepEqual(insert.metadata, {
      recipientPersonId: "person-bob",
    });
    assert.equal(insert.sender_display_name, "Andrew");
    assert.equal(insert.sender_role, "dashboard");
    assert.equal(insert.sender_user_id, "user-1");
  });

  it("stores recipient snapshots without making a receiver the destination", () => {
    const insert = connectMessageInsertFromInput(
      {
        body: "Dinner is ready.",
        metadata: {
          recipientDisplayNameSnapshot: "Bob",
        },
        to: "Bob",
      },
      {
        accessType: "user",
        careCircleId: "care-circle-1",
        createdByUserId: "user-1",
        mainConnectUserPersonId: "person-bob",
        receiverDeviceId: "receiver-bedroom",
        supabase: {} as never,
      }
    );

    assert.equal(insert.receiver_device_id, null);
    assert.deepEqual(insert.metadata, {
      recipientDisplayNameSnapshot: "Bob",
      recipientPersonId: "person-bob",
    });
  });

  it("builds receiver-authored message inserts from receiver device access", () => {
    const insert = connectMessageInsertFromInput(
      {
        body: "Please call Andrew.",
        from: "receiver_user",
        to: "Andrew",
      },
      {
        accessType: "receiver_device",
        careCircleId: "care-circle-1",
        createdByUserId: null,
        mainConnectUserPersonId: "person-bob",
        receiverDeviceId: "receiver-1",
        supabase: {} as never,
      }
    );

    assert.equal(insert.main_connect_user_person_id, "person-bob");
    assert.equal(insert.receiver_device_id, "receiver-1");
    assert.equal(insert.sender_role, "receiver");
    assert.equal(insert.sender_user_id, null);
  });

  it("maps lifecycle state updates to timestamp columns", () => {
    const timestamp = "2026-07-09T12:00:00.000Z";

    assert.deepEqual(connectMessageStateUpdate("read", timestamp), {
      acknowledged_at: undefined,
      callback_requested_at: undefined,
      heard_at: undefined,
      read_at: timestamp,
      updated_at: timestamp,
    });
    assert.deepEqual(connectMessageStateUpdate("acknowledged", timestamp), {
      acknowledged_at: timestamp,
      callback_requested_at: undefined,
      heard_at: undefined,
      read_at: undefined,
      updated_at: timestamp,
    });
    assert.deepEqual(connectMessageStateUpdate("callback_requested", timestamp), {
      acknowledged_at: undefined,
      callback_requested_at: timestamp,
      heard_at: undefined,
      read_at: undefined,
      updated_at: timestamp,
    });
  });

  it("maps durable rows back to existing message response shape", () => {
    const appointmentId = "11111111-2222-4333-8444-555555555555";
    const message = connectMessageRecordFromRow({
      acknowledged_at: "2026-07-09T12:05:00.000Z",
      allows_callback_request: true,
      appointment_id: appointmentId,
      audio_artifact_id: "",
      audio_duration_ms: null,
      audio_mime_type: "",
      audio_url: "",
      body: "Please call when you can.",
      callback_requested_at: "2026-07-09T12:06:00.000Z",
      client_message_id: "coordinator-text-1",
      created_at: "2026-07-09T12:00:00.000Z",
      delivered_at: null,
      heard_at: null,
      id: "message-1",
      main_connect_user_person_id: "person-bob",
      message_type: "text",
      metadata: { source: "test" },
      read_at: "2026-07-09T12:01:00.000Z",
      receiver_device_id: "receiver-1",
      recipient_display_name: "Bob",
      requires_acknowledgement: true,
      sender_display_name: "Andrew",
      sender_role: "dashboard",
      sender_user_id: "user-1",
      source: "coordinator_text_message",
      transcript: "",
      transcript_status: "",
      updated_at: "2026-07-09T12:06:00.000Z",
    });

    assert.equal(message.id, "message-1");
    assert.equal(message.mainConnectUserPersonId, "person-bob");
    assert.equal(message.from, "Andrew");
    assert.equal(message.to, "Bob");
    assert.equal(message.requiresAcknowledgement, true);
    assert.equal(message.appointmentId, appointmentId);
    assert.equal(message.allowsCallbackRequest, true);
    assert.equal(message.acknowledgedAt, "2026-07-09T12:05:00.000Z");
    assert.equal(message.callbackRequestedAt, "2026-07-09T12:06:00.000Z");
  });

  it("recovers appointment context from appointment composer client ids", () => {
    const appointmentId = "11111111-2222-4333-8444-555555555555";
    const message = connectMessageRecordFromRow({
      acknowledged_at: null,
      allows_callback_request: true,
      appointment_id: null,
      audio_artifact_id: "",
      audio_duration_ms: null,
      audio_mime_type: "",
      audio_url: "",
      body: "Bring your glasses.",
      callback_requested_at: null,
      client_message_id: `appointment-text-${appointmentId}-1`,
      created_at: "2026-07-09T12:00:00.000Z",
      delivered_at: null,
      heard_at: null,
      id: "message-1",
      main_connect_user_person_id: "person-bob",
      message_type: "text",
      metadata: {},
      read_at: null,
      receiver_device_id: null,
      recipient_display_name: "Bob",
      requires_acknowledgement: true,
      sender_display_name: "Andrew",
      sender_role: "dashboard",
      sender_user_id: "user-1",
      source: "appointment_text_message",
      transcript: "",
      transcript_status: "",
      updated_at: "2026-07-09T12:00:00.000Z",
    });

    assert.equal(message.appointmentId, appointmentId);
  });
});
