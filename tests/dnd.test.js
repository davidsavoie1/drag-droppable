import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";
import {
  configureDnD,
  dnd,
  dndDrag,
  dndDrop,
  draggable,
  dragDroppable,
  droppable,
} from "../src/index.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

function combined(t, options) {
  const element = new TestElement();
  const binding = dnd(element, options);
  t.after(binding.destroy);
  return { element, binding };
}

test("combined bindings share data and call onDrop only on the receiving element", (t) => {
  const calls = [];
  const starts = [];
  const ends = [];
  const sourceData = { name: "Mia" };
  const targetData = { name: "Leo" };
  const source = combined(t, {
    type: "baby",
    namespace: "nursery",
    data: sourceData,
    onDrag: (...args) => starts.push(args),
    onDragEnd: (...args) => ends.push(args),
    onDrop: () => calls.push("source"),
  });
  const target = combined(t, {
    type: "baby",
    namespace: "nursery",
    data: targetData,
    bottomTopThreshold: 0.2,
    onDrop: (args) => calls.push(args),
  });
  for (const { element } of [source, target]) {
    assert.equal(element.hasAttribute("data-dnd-draggable"), true);
    assert.equal(element.hasAttribute("data-dnd-droppable"), true);
  }

  send(source.element, "dragstart");
  flushFrames();
  send(target.element, "dragover", { clientY: 90 });
  send(target.element, "drop", { clientY: 90 });
  send(source.element, "dragend");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].drag, sourceData);
  assert.equal(calls[0].drop, targetData);
  assert.equal(calls[0].bottom, true);
  assert.equal(calls[0].namespace, "nursery");
  assert.deepEqual(starts, [[sourceData, "baby", "nursery"]]);
  assert.deepEqual(ends, [[sourceData, "baby", "nursery"]]);
});

test("combined type is emitted while types and callback maps control accepted drags", (t) => {
  const calls = [];
  const both = combined(t, {
    type: "baby",
    types: ["toy", "food"],
    data: "Mia",
    onDrop: {
      toy: ({ drag, drop }) => calls.push(["toy", drag, drop]),
      food: ({ drag, drop }) => calls.push(["food", drag, drop]),
    },
  });
  const target = bind(t, droppable, {
    type: "baby",
    onDrop: ({ drag }) => calls.push(["baby", drag]),
  });
  send(both.element, "dragstart");
  flushFrames();
  assert.equal(send(both.element, "dragover").defaultPrevented, false);
  send(target.element, "dragover");
  send(target.element, "drop");
  send(both.element, "dragend");

  for (const type of ["toy", "food"]) {
    const source = bind(t, draggable, { type, data: type + " data" });
    send(source.element, "dragstart");
    flushFrames();
    send(both.element, "dragover");
    send(both.element, "drop");
    send(source.element, "dragend");
  }
  assert.deepEqual(calls, [
    ["baby", "Mia"],
    ["toy", "toy data", "Mia"],
    ["food", "food data", "Mia"],
  ]);
});

test("combined updater runs once on a shallow copy and refreshes a hovered drop", (t) => {
  const received = [];
  let oldCalls = 0;
  const data = { name: "Mia" };
  const initial = { type: "toy", data, onDrop: () => oldCalls++ };
  const target = combined(t, initial);
  const source = bind(t, draggable, { type: "toy", data: "duck" });
  send(source.element, "dragstart");
  flushFrames();
  send(target.element, "dragover");

  let updates = 0;
  target.binding.update((current) => {
    updates++;
    assert.notEqual(current, initial);
    assert.equal(current.data, data);
    return { ...current, data: "Leo", onDrop: (args) => received.push(args) };
  });
  assert.equal(updates, 1);
  assert.equal(target.element.hasAttribute("data-dnd-can"), true);
  send(target.element, "drop");
  send(source.element, "dragend");
  assert.equal(oldCalls, 0);
  assert.equal(received.length, 1);
  assert.equal(received[0].drop, "Leo");
  assert.equal(initial.data, data);
});

test("combined updates clean both prefixes, reset on falsy input and destroy terminally", (t) => {
  const { element, binding } = combined(t, { type: "baby" });
  binding.update({
    type: "toy",
    namespace: "upstairs",
    attributesPrefix: "foo",
  });
  assert.equal(
    [...element.attributes.keys()].some((key) => key.startsWith("data-dnd-")),
    false,
  );
  assert.equal(element.attributes.get("data-foo-draggable-type"), "toy");
  assert.equal(
    element.attributes.get("data-foo-droppable-namespace"),
    "upstairs",
  );
  binding.update(() => false);
  assert.equal(element.attributes.size, 0);
  binding.update((current) => {
    assert.deepEqual(current, { disabled: true });
    return { type: "baby" };
  });
  assert.equal(element.hasAttribute("data-dnd-draggable"), true);
  assert.equal(element.hasAttribute("data-dnd-droppable"), true);
  binding.destroy();
  binding.destroy();
  assert.equal(element.attributes.size, 0);
  assert.throws(() => binding.update({ type: "toy" }), /destroyed/);
  let called = false;
  assert.throws(
    () =>
      binding.update(() => {
        called = true;
      }),
    /destroyed/,
  );
  assert.equal(called, false);
});

test("destroying an active combined source ends target participation", (t) => {
  let drops = 0;
  const source = combined(t, { type: "baby" });
  const target = combined(t, { type: "baby", onDrop: () => drops++ });
  send(source.element, "dragstart");
  flushFrames();
  send(target.element, "dragover");
  source.binding.destroy();
  assert.equal(source.element.attributes.size, 0);
  assert.equal(target.element.hasAttribute("data-dnd-concerned"), false);
  assert.equal(target.element.hasAttribute("data-dnd-can"), false);
  send(target.element, "drop");
  assert.equal(drops, 0);
});

test("combined cleanup destroys the target even when onDragEnd throws", (t) => {
  const failure = new Error("End failed");
  const { element, binding } = combined(t, {
    type: "baby",
    onDragEnd: () => {
      throw failure;
    },
  });
  send(element, "dragstart");
  flushFrames();
  assert.throws(binding.destroy, (error) => error === failure);
  assert.equal(element.hasAttribute("data-dnd-droppable"), false);
  assert.equal(element.hasAttribute("data-dnd-concerned"), false);
  assert.doesNotThrow(binding.destroy);
});

test("onDragEnd can destroy the combined binding during a disabling update", (t) => {
  let binding;
  const result = combined(t, {
    type: "baby",
    onDragEnd: () => binding.destroy(),
  });
  binding = result.binding;
  send(result.element, "dragstart");
  flushFrames();
  assert.doesNotThrow(() => binding.update(false));
  assert.equal(result.element.attributes.size, 0);
});

for (const action of [dndDrag, dndDrop]) {
  test(`${action.name} still unbinds supplied controllers without destroying them`, (t) => {
    const factory = action === dndDrag ? draggable : droppable;
    const controller = factory({ type: "baby" });
    t.after(controller.destroy);
    const element = new TestElement();
    const binding = action(element, controller);
    binding.update(controller);
    const replacement = factory({ type: "toy" });
    t.after(replacement.destroy);
    assert.throws(() => binding.update(replacement), /replace/);
    binding.destroy();
    assert.equal(element.attributes.size, 0);
    assert.doesNotThrow(() => controller.bind(new TestElement()));
  });
}

test("combined controllers reject their own drag and accept identical data from others", (t) => {
  const data = { name: "Mia" };
  const calls = [];
  const source = combined(t, {
    type: "baby",
    data,
    onDrop: (args) => calls.push(args),
  });
  const target = combined(t, {
    type: "baby",
    data,
    onDrop: (args) => calls.push(args),
  });
  send(source.element, "dragstart");
  flushFrames();
  assert.equal(send(source.element, "dragover").defaultPrevented, true);
  assert.equal(source.element.hasAttribute("data-dnd-can"), false);
  assert.equal(source.element.hasAttribute("data-dnd-unconcerned"), true);
  send(source.element, "drop");
  assert.equal(calls.length, 0);
  send(target.element, "dragover");
  assert.equal(target.element.hasAttribute("data-dnd-can"), true);
  send(target.element, "drop");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].drag, data);
  assert.equal(calls[0].drop, data);
  send(source.element, "dragend");
});

for (const allowed of [true, false]) {
  test(`self-drop opt-in still applies acceptance predicates (${allowed})`, (t) => {
    let calls = 0;
    const { element } = combined(t, {
      type: "baby",
      allowSelfDrop: true,
      when: { baby: () => allowed },
      onDrop: { baby: () => calls++ },
    });
    send(element, "dragstart");
    flushFrames();
    send(element, "dragover");
    send(element, "drop");
    assert.equal(calls, allowed ? 1 : 0);
    send(element, "dragend");
  });
}

test("allowSelfDrop can change during a drag and resets with replacement options", (t) => {
  let calls = 0;
  const element = new TestElement();
  const store = dragDroppable({ type: "baby", onDrop: () => calls++ });
  t.after(store.destroy);
  store.bind(element);
  send(element, "dragstart");
  flushFrames();
  assert.equal(store.getSnapshot().concerned, false);
  store.update((current) => ({ ...current, allowSelfDrop: true }));
  send(element, "dragover");
  assert.equal(store.getSnapshot().canDrop, true);
  store.update((current) => ({ ...current, allowSelfDrop: false }));
  assert.equal(store.getSnapshot().canDrop, false);
  send(element, "drop");
  assert.equal(calls, 0);
  store.update((current) => ({ ...current, allowSelfDrop: true }));
  send(element, "dragover");
  send(element, "drop");
  assert.equal(calls, 1);
  store.update({ type: "baby" });
  assert.equal(store.getSnapshot().concerned, false);
  send(element, "dragend");
});

test("separate source and target controllers still allow a drop on the same element", (t) => {
  const element = new TestElement();
  let calls = 0;
  bind(t, draggable, { type: "baby" }, element);
  bind(t, droppable, { type: "baby", onDrop: () => calls++ }, element);
  send(element, "dragstart");
  flushFrames();
  send(element, "dragover");
  send(element, "drop");
  assert.equal(calls, 1);
  send(element, "dragend");
});
