import assert from "node:assert/strict";
import test from "node:test";

import { filterMembers } from "../components/reports/MemberFilter";

const members = [
  { id: "1", name: "Lee Rika Dela Cruz", username: "lieurika" },
  { id: "2", name: "Lieu Rikawa", username: "lieurika2" },
  { id: "3", name: "Maria Santos", username: "msantos" },
  { id: "4", name: "yurik", username: "yuki" },
];

test("an empty query offers every member", () => {
  // The picker opens showing the full list, so officers can browse as well as
  // search rather than having to know a name in advance.
  for (const q of ["", "   "]) {
    assert.equal(filterMembers(members, q).length, members.length);
  }
});

test("searching by name is case-insensitive and matches part of the name", () => {
  assert.deepEqual(
    filterMembers(members, "lee").map((m) => m.id),
    ["1"],
  );
  assert.deepEqual(
    filterMembers(members, "SANTOS").map((m) => m.id),
    ["3"],
  );
  // Typing part of a name still finds them, including a first-name prefix.
  assert.deepEqual(
    filterMembers(members, "cruz").map((m) => m.id),
    ["1"],
  );
  assert.deepEqual(
    filterMembers(members, "lee rika").map((m) => m.id),
    ["1"],
  );
});

test("a name that resembles a username still matches on either field", () => {
  // "lieu" is the start of member 2's name and of member 1's username, so
  // both come back. That is the point of searching both fields: officers
  // reach for whichever identifier they happen to remember.
  assert.deepEqual(
    filterMembers(members, "lieu").map((m) => m.id),
    ["1", "2"],
  );
});

test("searching by username finds the member", () => {
  // Officers know members by username as often as by name, so the username has
  // to be searchable rather than just being printed under the name.
  assert.deepEqual(
    filterMembers(members, "yuki").map((m) => m.id),
    ["4"],
  );
  assert.deepEqual(
    filterMembers(members, "msantos").map((m) => m.id),
    ["3"],
  );
});

test("surrounding whitespace in the query is ignored", () => {
  assert.deepEqual(
    filterMembers(members, "  maria  ").map((m) => m.id),
    ["3"],
  );
});

test("a query that matches nothing returns nothing, not everyone", () => {
  // Falling back to the full list would silently report on all members, which
  // is the opposite of what an officer who typed a specific name asked for.
  assert.deepEqual(filterMembers(members, "zzzz"), []);
  assert.deepEqual(filterMembers(members, "@lieurika"), []);
});
