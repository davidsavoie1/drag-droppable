import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import configureDnD, { getConfig, getTouchConfig } from "../src/configure.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

test("global updates preserve the prefix but resolve touch against defaults", () => {
  configureDnD({ attributesPrefix: "custom", touch: { pressHold: 500 } });
  configureDnD({ touch: { vibration: false } });
  assert.equal(getConfig().attributesPrefix, "custom");
  assert.equal(getTouchConfig().pressHold, 300);
  assert.equal(getTouchConfig().vibration, false);
  configureDnD();
  assert.equal(getTouchConfig().pressHold, 300);
});

test("global true restores touch defaults after custom settings or disabling", () => {
  configureDnD({ touch: { pressHold: 700 } });
  configureDnD({ touch: true });
  assert.equal(getTouchConfig().pressHold, 300);
  configureDnD({ touch: false });
  assert.equal(getTouchConfig(), false);
  configureDnD({ touch: null });
  assert.equal(getTouchConfig(), null);
  configureDnD({ touch: { vibration: false } });
  assert.equal(getTouchConfig().pressHold, 300);
  assert.equal(getTouchConfig().vibration, false);
});

test("touch config readers do not expose top-level mutable settings", () => {
  const snapshot = getTouchConfig();
  snapshot.pressHold = 900;
  assert.equal(getTouchConfig().pressHold, 300);
});
