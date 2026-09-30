import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import { getCatalog } from "../components/reports/catalog";
import { returnConditionText } from "../lib/machine-return";

/**
 * The condition column was originally added to ReportModal's ReportBody
 * switch, which nothing imports: the modal renders ReportDocument, driven by
 * the catalog. The code compiled, the API returned the right payload, and the
 * column still never appeared on screen. These tests assert against the
 * catalog specifically, because that is the path that is actually rendered.
 */
const catalog = getCatalog("MACHINES");
if (!catalog) throw new Error("MACHINES report is not registered");

const section = (id: string) => {
  const found = catalog.sections.find((s) => s.id === id);
  if (!found) throw new Error(`MACHINES report has no "${id}" section`);
  return found;
};

const machineRequests = [
  {
    id: "r1",
    user: { name: "lee" },
    status: "RETURNED",
    requestDate: "2026-09-01T00:00:00.000Z",
    startDate: "2026-09-02T00:00:00.000Z",
    endDate: "2026-09-04T00:00:00.000Z",
    returnedAt: "2026-09-05T00:00:00.000Z",
    returnNote: "Rear tyre flat, belt frayed",
    returnHasIssue: true,
  },
  {
    id: "r2",
    user: { name: "LieuRikawa" },
    status: "IN_USE",
    requestDate: "2026-09-06T00:00:00.000Z",
    startDate: "2026-09-06T00:00:00.000Z",
    endDate: "2026-09-08T00:00:00.000Z",
    returnedAt: null,
    returnNote: null,
    returnHasIssue: false,
  },
  {
    // Returned before the condition feature existed, so nothing was stored.
    id: "r3",
    user: { name: "LieuRikawa" },
    status: "RETURNED",
    requestDate: "2026-08-01T00:00:00.000Z",
    startDate: "2026-08-02T00:00:00.000Z",
    endDate: "2026-08-03T00:00:00.000Z",
    returnedAt: "2026-08-04T00:00:00.000Z",
    returnNote: null,
    returnHasIssue: false,
  },
];

const payload = {
  totals: { machines: 1, requests: 3, overdue: 0, returnsWithIssues: 1 },
  machines: [{ id: "m1", name: "Tractor", requests: machineRequests }],
  returnsWithIssues: [
    {
      id: "r1",
      machine: "Tractor",
      member: { name: "lee" },
      condition: "Rear tyre flat, belt frayed",
      returnedAt: "2026-09-05T00:00:00.000Z",
    },
  ],
} as never;

test("the request table carries a Condition on Return column", () => {
  const columns = section("requestsTable").table!.columns;
  const condition = columns.find((c) => c.id === "condition");
  assert.ok(condition, "requestsTable has no condition column");
  assert.equal(condition.label, "Condition on Return");
});

test("the request table shows the stored condition for a returned machine", () => {
  const rows = section("requestsTable").table!.rows(payload) as Record<
    string,
    unknown
  >[];
  const flagged = rows.find((r) => r.member === "lee");
  assert.equal(flagged?.returnNote, "Rear tyre flat, belt frayed");

  const rendered = section("requestsTable")
    .table!.columns.find((c) => c.id === "condition")!
    .render(flagged!);
  assert.equal(rendered, "Rear tyre flat, belt frayed");
});

test("a machine still out shows a dash, not an unrecorded condition", () => {
  // Nothing was inspected while the machine was still borrowed, so the cell
  // must not imply a condition was recorded.
  assert.equal(
    returnConditionText({ returnedAt: null, returnNote: null }),
    "—",
  );
  assert.equal(
    returnConditionText({ returnedAt: "2026-09-05T00:00:00.000Z", returnNote: "Chipped housing" }),
    "Chipped housing",
  );
});

test("a return with no stored note falls back to the good-condition wording", () => {
  const rows = section("requestsTable").table!.rows(payload) as Record<
    string,
    string
  >[];
  const legacy = rows.filter((r) => r.member === "LieuRikawa");
  assert.equal(legacy[0].returnNote, "—");
  assert.equal(legacy[1].returnNote, "Returned in good condition");
});

test("the report counts and lists returns that came back with an issue", () => {
  const total = section("totals").kvs!.find((k) => k.id === "returnsWithIssue");
  assert.ok(total, "totals has no returnsWithIssue metric");
  assert.equal(total.label, "Returned With Issue");
  assert.equal(total.value(payload), 1);

  const issues = section("returnsWithIssues");
  assert.ok(issues.table!.columns.some((c) => c.id === "condition"));
  assert.equal((issues.table!.rows(payload) as unknown[]).length, 1);
  // Included by default, and hidden entirely when nothing came back damaged.
  assert.ok(catalog.defaultSections.includes("returnsWithIssues"));
  assert.equal(issues.hideWhenEmpty!({ returnsWithIssues: [] } as never), true);
  assert.equal(
    issues.hideWhenEmpty!({ returnsWithIssues: [{}] } as never),
    false,
  );
});
