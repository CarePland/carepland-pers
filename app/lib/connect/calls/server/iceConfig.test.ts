import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { connectIceConfigFromEnv, resolveConnectIceConfig } from "./iceConfig";

describe("Connect call ICE config", () => {
  it("uses short-lived Twilio ICE servers when Twilio env is present", async () => {
    const requestedUrls: string[] = [];
    const requestedAuthorizationHeaders: string[] = [];
    const config = await resolveConnectIceConfig({
      env: {
        CONNECT_TURN_URLS: "turn:fallback.example.com:3478",
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_AUTH_TOKEN: "secret-auth-token",
      },
      fetchIceToken: async (url, init) => {
        requestedUrls.push(url);
        requestedAuthorizationHeaders.push(init.headers.Authorization);
        return {
          json: async () => ({
            ice_servers: [
              { urls: "stun:global.stun.twilio.com:3478" },
              {
                credential: "short-lived-credential",
                urls: "turn:global.turn.twilio.com:3478?transport=udp",
                username: "short-lived-username",
              },
            ],
          }),
          ok: true,
          status: 201,
        };
      },
    });

    assert.equal(config.source, "twilio");
    assert.equal(config.hasTurnServer, true);
    assert.equal(
      requestedUrls[0],
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Tokens.json"
    );
    assert.match(requestedAuthorizationHeaders[0], /^Basic /);
    assert.equal(requestedAuthorizationHeaders[0].includes("secret-auth-token"), false);
    assert.deepEqual(config.iceServers, [
      { urls: "stun:global.stun.twilio.com:3478" },
      {
        credential: "short-lived-credential",
        urls: "turn:global.turn.twilio.com:3478?transport=udp",
        username: "short-lived-username",
      },
    ]);
  });

  it("falls back safely when Twilio token generation fails", async () => {
    const config = await resolveConnectIceConfig({
      env: {
        CONNECT_TURN_CREDENTIAL: "server-pass",
        CONNECT_TURN_URLS: "turn:server.example.com:3478",
        CONNECT_TURN_USERNAME: "server-user",
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_AUTH_TOKEN: "secret-auth-token",
      },
      fetchIceToken: async () => ({
        json: async () => ({ message: "nope" }),
        ok: false,
        status: 503,
      }),
    });

    assert.equal(config.source, "server_env");
    assert.deepEqual(config.iceServers, [
      {
        credential: "server-pass",
        urls: ["turn:server.example.com:3478"],
        username: "server-user",
      },
    ]);
  });

  it("does not require Twilio env for existing behavior", async () => {
    const config = await resolveConnectIceConfig({
      env: {
        NEXT_PUBLIC_CONNECT_STUN_URLS: "stun:public.example.com:19302",
      },
      fetchIceToken: async () => {
        throw new Error("Twilio should not be called without Twilio env.");
      },
    });

    assert.equal(config.source, "public_env");
    assert.deepEqual(config.iceServers, [
      { urls: ["stun:public.example.com:19302"] },
    ]);
  });

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
