import assert from "node:assert/strict";
import test from "node:test";

import { runAdminMutation } from "../lib/admin-mutation";

test("admin mutations refresh records after a server conflict", async () => {
  const conflict = new Error("Loan cannot move from ACTIVE to APPROVED");
  let refreshCount = 0;
  let receivedError: unknown;

  await runAdminMutation({
    request: async () => {
      throw conflict;
    },
    refresh: async () => {
      refreshCount += 1;
    },
    onSuccess: () => {
      assert.fail("a conflicting mutation cannot succeed");
    },
    onError: (error) => {
      receivedError = error;
    },
  });

  assert.equal(receivedError, conflict);
  assert.equal(refreshCount, 1);
});
