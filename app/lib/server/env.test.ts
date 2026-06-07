import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isMissingServerEnvError,
  MissingServerEnvError,
} from "./env.js";

describe("server env helpers", () => {
  const completeEnv = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://carepland.example",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  it("returns normalized anon Supabase config", () => {
    assert.deepEqual(getSupabaseAnonConfig(completeEnv), {
      anonKey: "anon-key",
      url: "https://carepland.example",
    });
  });

  it("returns normalized service-role Supabase config", () => {
    assert.deepEqual(getSupabaseServiceConfig(completeEnv), {
      anonKey: "anon-key",
      serviceRoleKey: "service-role-key",
      url: "https://carepland.example",
    });
  });

  it("reports all missing anon config names together", () => {
    assert.throws(
      () => getSupabaseAnonConfig({}),
      (error) =>
        error instanceof MissingServerEnvError &&
        error.variableNames.includes("NEXT_PUBLIC_SUPABASE_URL") &&
        error.variableNames.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );
  });

  it("detects missing server env errors", () => {
    const error = new MissingServerEnvError(["SUPABASE_SERVICE_ROLE_KEY"]);

    assert.equal(isMissingServerEnvError(error), true);
    assert.equal(isMissingServerEnvError(new Error("Nope")), false);
  });
});
