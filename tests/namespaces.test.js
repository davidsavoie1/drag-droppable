import assert from "node:assert/strict";
import { test } from "node:test";
import {
  publishDrag,
  registerDragListeners,
  unregisterDragListeners,
} from "../src/dndSubs.js";

function listen(t, namespace, type, callback) {
  const listeners = Object.fromEntries([[type, callback]]);
  registerDragListeners(listeners, namespace);
  t.after(() => unregisterDragListeners(listeners, namespace));
}

test("both namespace and type must match", (t) => {
  const received = [];
  listen(t, "planning", "task", () => received.push("planning task"));
  listen(t, "editor", "task", () => received.push("editor task"));
  listen(t, "planning", "document", () => received.push("document"));
  publishDrag({ namespace: "planning", type: "task" });
  assert.deepEqual(received, ["planning task"]);
});

test("separator characters do not cause namespace/type collisions", (t) => {
  let calls = 0;
  listen(t, "a::b", "c", () => {
    calls++;
  });
  publishDrag({ namespace: "a", type: "b::c" });
  assert.equal(calls, 0);
  publishDrag({ namespace: "a::b", type: "c" });
  assert.equal(calls, 1);
});

test("prototype property names are valid types", (t) => {
  let calls = 0;
  for (const type of ["constructor", "__proto__", "toString"]) {
    listen(t, "special", type, () => {
      calls++;
    });
    publishDrag({ namespace: "special", type });
  }
  assert.equal(calls, 3);
});

test("omitted and empty namespaces share the default group; unsubscribe removes it", () => {
  let calls = 0;
  const listeners = {
    task: () => {
      calls++;
    },
  };
  registerDragListeners(listeners);
  try {
    publishDrag({ namespace: "", type: "task" });
    assert.equal(calls, 1);
  } finally {
    unregisterDragListeners(listeners);
  }
  publishDrag({ type: "task" });
  assert.equal(calls, 1);
});
