import assert from "node:assert/strict";
import { test } from "node:test";
import {
  publishDrag,
  registerDragCleanup,
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
  const end = publishDrag({ namespace: "planning", type: "task" });
  t.after(end);
  assert.deepEqual(received, ["planning task"]);
});

test("separator characters do not cause namespace/type collisions", (t) => {
  let calls = 0;
  listen(t, "a::b", "c", () => {
    calls++;
  });
  const firstEnd = publishDrag({ namespace: "a", type: "b::c" });
  firstEnd();
  assert.equal(calls, 0);
  const end = publishDrag({ namespace: "a::b", type: "c" });
  t.after(end);
  assert.equal(calls, 1);
});

test("prototype property names are valid types", (t) => {
  let calls = 0;
  for (const type of ["constructor", "__proto__", "toString"]) {
    listen(t, "special", type, () => {
      calls++;
    });
    const end = publishDrag({ namespace: "special", type });
    end();
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
    const end = publishDrag({ namespace: "", type: "task" });
    end();
    assert.equal(calls, 1);
  } finally {
    unregisterDragListeners(listeners);
  }
  const end = publishDrag({ type: "task" });
  end();
  assert.equal(calls, 1);
});

test("late listeners receive only a matching namespace and type", (t) => {
  const data = { id: 1 };
  const onDrop = () => {};
  const end = publishDrag({
    namespace: "planning",
    type: "task",
    data,
    onDrop,
  });
  t.after(end);
  const received = [];
  listen(t, "editor", "task", () => received.push("wrong namespace"));
  listen(t, "planning", "document", () => received.push("wrong type"));
  listen(t, "planning", "task", (session) => received.push(session));
  assert.deepEqual(received, [
    { namespace: "planning", type: "task", data, onDrop },
  ]);
  assert.equal(received[0].data, data);
  assert.equal(received[0].onDrop, onDrop);
});

test("late listeners normalize omitted, null and empty namespaces", (t) => {
  const end = publishDrag({ type: "task" });
  t.after(end);
  let calls = 0;
  for (const namespace of [undefined, null, ""]) {
    listen(t, namespace, "task", () => {
      calls++;
    });
  }
  assert.equal(calls, 3);
});

test("a drag without initial listeners still cleans targets added later", (t) => {
  const end = publishDrag({ type: "late" });
  t.after(end);
  assert.equal(typeof end, "function");
  let cleaned = 0;
  listen(t, undefined, "late", () => {
    registerDragCleanup(() => {
      cleaned++;
    });
  });
  end();
  assert.equal(cleaned, 1);
  end();
  assert.equal(cleaned, 1);
  let callsAfterEnd = 0;
  listen(t, undefined, "late", () => {
    callsAfterEnd++;
  });
  assert.equal(callsAfterEnd, 0);
});

test("listeners registered during publication join the drag and are cleaned", (t) => {
  const received = [];
  const cleaned = [];
  listen(t, "A", "task", () => {
    received.push("first");
    registerDragCleanup(() => cleaned.push("first"));
    listen(t, "A", "task", () => {
      received.push("late");
      registerDragCleanup(() => cleaned.push("late"));
    });
  });
  const end = publishDrag({ namespace: "A", type: "task" });
  t.after(end);
  assert.deepEqual(received, ["first", "late"]);
  end();
  assert.deepEqual(cleaned, ["first", "late"]);
});

test("registrations caused by cleanup do not join the ended session", (t) => {
  let lateCalls = 0;
  listen(t, "A", "task", () => {
    registerDragCleanup(() => {
      listen(t, "A", "task", () => {
        lateCalls++;
      });
    });
  });
  const end = publishDrag({ namespace: "A", type: "task" });
  t.after(end);
  end();
  assert.equal(lateCalls, 0);
});
