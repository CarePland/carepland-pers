import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InactiveAccountError,
  assertAccountActive,
  isAccountActive,
  normalizeAccountStatus,
} from "./accountStatus";

function fakeSupabase(accountStatus: string | null) {
  return {
    from(tableName: string) {
      assert.equal(tableName, "profiles");

      return {
        select(columnName: string) {
          assert.equal(columnName, "account_status");

          return {
            eq(columnNameForFilter: string, userId: string) {
              assert.equal(columnNameForFilter, "id");
              assert.equal(userId, "user-1");

              return {
                async single() {
                  return {
                    data: { account_status: accountStatus },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("account status helpers", () => {
  it("treats unknown statuses as active-compatible for migration safety", () => {
    assert.equal(normalizeAccountStatus(null), "active");
    assert.equal(normalizeAccountStatus("active"), "active");
    assert.equal(normalizeAccountStatus("unexpected"), "active");
    assert.equal(isAccountActive("inactive"), false);
  });

  it("allows active accounts", async () => {
    await assert.doesNotReject(
      assertAccountActive(fakeSupabase("active") as never, "user-1")
    );
  });

  it("blocks inactive accounts", async () => {
    await assert.rejects(
      assertAccountActive(fakeSupabase("inactive") as never, "user-1"),
      InactiveAccountError
    );
  });
});
