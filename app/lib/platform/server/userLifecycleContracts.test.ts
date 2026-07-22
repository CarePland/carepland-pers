import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = process.cwd();

function sourceFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("user lifecycle contracts", () => {
  it("keeps the migration active by default and rejects unsupported account statuses", () => {
    const migration = sourceFile("supabase/sql/2026-07-21_user_lifecycle_inactive.sql");

    assert.match(
      migration,
      /account_status text not null default 'active'\s+check \(account_status in \('active', 'inactive'\)\)/
    );
    assert.match(migration, /coalesce\(p\.account_status, 'active'\) = 'active'/);
    assert.match(migration, /create or replace function public\.assert_current_user_is_admin\(\)/);
    assert.match(migration, /coalesce\(p\.is_admin, false\) = true/);
  });

  it("blocks inactive accounts in the Admin lifecycle route and preserves restore semantics", () => {
    const route = sourceFile("app/api/admin/user-lifecycle/route.ts");
    const adminAuth = sourceFile("app/lib/platform/server/adminAuth.ts");

    assert.match(route, /requireAdminCaller/);
    assert.match(adminAuth, /getActiveSupabaseUser/);
    assert.match(route, /CarePland must keep at least one active Admin/);
    assert.match(route, /ban_duration: nextStatus === "inactive" \? inactiveBanDuration : "none"/);
    assert.match(route, /\.from\("offline_authorizations"\)/);
    assert.match(route, /event_type:\s+nextStatus === "inactive"/);
    assert.doesNotMatch(route, /\.delete\(/);
  });

  it("suppresses covered user-directed notifications for inactive recipients", () => {
    for (const relativePath of [
      "app/api/ask-message-notifications/route.ts",
      "app/api/support-ticket-notifications/route.ts",
    ]) {
      const route = sourceFile(relativePath);

      assert.match(route, /account_status/);
      assert.match(route, /suppressed_inactive_account/);
      assert.match(route, /recipientProfile\?\.account_status === "inactive"/);
    }
  });
});
