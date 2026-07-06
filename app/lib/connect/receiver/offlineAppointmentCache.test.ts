import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatReceiverCacheTimestamp,
  readReceiverAppointmentCache,
  receiverAppointmentCacheKey,
  receiverConnectivityStatusLabel,
  receiverOfflineActionMessage,
  writeReceiverAppointmentCache,
  type ReceiverStorageLike,
} from "./offlineAppointmentCache";

function createMemoryStorage(initial: Record<string, string> = {}): ReceiverStorageLike {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("Receiver appointment offline cache", () => {
  it("writes and reads minimal appointment display fields per person", () => {
    const storage = createMemoryStorage();

    writeReceiverAppointmentCache(
      storage,
      "person-1",
      [
        {
          id: "appointment-1",
          providerName: "Dr. Rivera",
          reason: "Follow up",
          startsAt: "2026-07-07T21:00:00.000Z",
          title: "Cardiology",
        },
      ],
      "2026-07-06T18:30:00.000Z"
    );

    const cached = readReceiverAppointmentCache(storage, "person-1");

    assert.equal(cached?.cachedAt, "2026-07-06T18:30:00.000Z");
    assert.equal(cached?.appointments.length, 1);
    assert.deepEqual(cached?.appointments[0], {
      id: "appointment-1",
      locationAddress: "",
      locationName: "",
      locationPhone: "",
      providerName: "Dr. Rivera",
      providerOrganization: "",
      reason: "Follow up",
      startsAt: "2026-07-07T21:00:00.000Z",
      title: "Cardiology",
    });
  });

  it("keeps appointment caches scoped by Main Connect User", () => {
    const storage = createMemoryStorage();

    writeReceiverAppointmentCache(storage, "person-1", [{ id: "a", title: "A" }]);
    writeReceiverAppointmentCache(storage, "person-2", [{ id: "b", title: "B" }]);

    assert.equal(readReceiverAppointmentCache(storage, "person-1")?.appointments[0]?.title, "A");
    assert.equal(readReceiverAppointmentCache(storage, "person-2")?.appointments[0]?.title, "B");
    assert.notEqual(receiverAppointmentCacheKey("person-1"), receiverAppointmentCacheKey("person-2"));
  });

  it("drops malformed cache entries instead of treating them as authority", () => {
    const key = receiverAppointmentCacheKey("person-1");
    const storage = createMemoryStorage({
      [key]: JSON.stringify({ appointments: [{ title: "Wrong" }], personId: "other", version: 1 }),
    });

    assert.equal(readReceiverAppointmentCache(storage, "person-1"), null);
    assert.equal(storage.getItem(key), null);
  });

  it("labels offline cache state and offline action copy", () => {
    assert.equal(receiverConnectivityStatusLabel({ online: true }), "Online");
    assert.equal(receiverConnectivityStatusLabel({ online: false }), "Offline");
    assert.equal(
      receiverConnectivityStatusLabel({ cachedAppointmentCount: 1, online: false }),
      "Offline — using saved appointment info"
    );
    assert.equal(
      receiverOfflineActionMessage(),
      "CarePland is offline right now. This feature needs an internet connection."
    );
    assert.ok(formatReceiverCacheTimestamp("2026-07-06T18:30:00.000Z"));
  });
});
