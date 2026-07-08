import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { connectIceConfigFromEnv } from "./iceConfig";

describe("Connect call ICE config", () => {
  it("uses server-side TURN settings before public settings", () => {
    const config = connectIceConfigFromEnv({
      CONNECT_STUN_URLS: "stun:server.example.com:19302",
      CONNECT_TURN_CREDENTIAL: "server-pass",
      CONNECT_TURN_URLS: "turn:server.example.com:3478",
      CONNECT_TURN_USERNAME: "server-user",
      NEXT_PUBLIC_CONNECT_TURN_URLS: "turn:public.example.com:3478",
    });

    assert.equal(config.source, "server_env");
    assert.equal(config.hasTurnServer, true);
    assert.deepEqual(config.iceServers, [
      { urls: ["stun:server.example.com:19302"] },
      {
        credential: "server-pass",
        urls: ["turn:server.example.com:3478"],
        username: "server-user",
      },
    ]);
  });

  it("accepts JSON ICE server config", () => {
    const config = connectIceConfigFromEnv({
      CONNECT_ICE_SERVERS_JSON: JSON.stringify([
        { urls: ["stun:json.example.com:19302"] },
        {
          credential: "json-pass",
          urls: ["turn:json.example.com:3478"],
          username: "json-user",
        },
      ]),
    });

    assert.equal(config.source, "server_env");
    assert.equal(config.hasTurnServer, true);
    assert.equal(config.iceServerCount, 2);
  });

  it("falls back to public env and then default STUN", () => {
    const publicConfig = connectIceConfigFromEnv({
      NEXT_PUBLIC_CONNECT_STUN_URLS: "stun:public.example.com:19302",
    });
    assert.equal(publicConfig.source, "public_env");
    assert.equal(publicConfig.hasTurnServer, false);
    assert.deepEqual(publicConfig.iceServers, [
      { urls: ["stun:public.example.com:19302"] },
    ]);

    const defaultConfig = connectIceConfigFromEnv({});
    assert.equal(defaultConfig.source, "default");
    assert.equal(defaultConfig.hasTurnServer, false);
    assert.deepEqual(defaultConfig.iceServers, [{ urls: "stun:stun.l.google.com:19302" }]);
  });
});
