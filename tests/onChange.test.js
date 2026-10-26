import assert from "node:assert/strict";
import { test } from "node:test";
import { droppable, draggable, dragDroppable, dndDrag, dndDrop, dnd } from "../src/index.js";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";

test("onChange is immediate, follows state, and replaces or removes callbacks", (t) => {
  const first = [];
  const second = [];
  const onChange = (state) => first.push(state);
  const target = bind(t, droppable, { type: "food", onChange });
  assert.deepEqual(first, [{}]);
  target.controller.update((options) => ({ ...options }));
  assert.equal(first.length, 1);
  const replacement = (state) => second.push(state);
  target.controller.update({ type: "food", onChange: replacement });
  assert.deepEqual(second, []);
  const source = bind(t, draggable, { type: "food" });
  send(source.element, "dragstart");
  flushFrames();
  assert.equal(first.length, 1);
  assert.equal(second.at(-1).concerned, true);
  send(target.element, "dragover");
  assert.equal(second.at(-1).accepts, true);
  const count = second.length;
  send(target.element, "dragover");
  assert.equal(second.length, count);
  target.controller.update({ type: "food" });
  send(source.element, "dragend");
  assert.equal(second.length, count);
  target.controller.update({ type: "food", onChange });
  assert.equal(first.length, 2);
  target.controller.update(null);
  target.controller.update({ type: "food", onChange });
  assert.equal(first.length, 3);
});

test("an immediate onChange can replace itself without duplicate notifications", (t) => {
  const target = bind(t, droppable, { type: "food" });
  const received = [];
  const replacement = (state) => received.push(state);
  let firstCalls = 0;
  target.controller.update({
    type: "food",
    onChange() {
      firstCalls++;
      target.controller.update({ type: "food", onChange: replacement });
    },
  });
  assert.equal(firstCalls, 1);
  assert.deepEqual(received, []);
  const source = bind(t, draggable, { type: "food" });
  send(source.element, "dragstart");
  flushFrames();
  assert.equal(received.length, 1);
  assert.equal(received.at(-1).concerned, true);
});

for (const operation of ["destroy", "unbind"]) {
  test(`onChange receives reset state on ${operation}`, (t) => {
    const received = [];
    const target = bind(t, droppable, {
      type: "food", onChange: (state) => received.push(state),
    });
    const source = bind(t, draggable, { type: "food" });
    send(source.element, "dragstart");
    flushFrames();
    send(target.element, "dragover");
    assert.equal(received.at(-1).accepts, true);
    target.controller[operation]();
    assert.deepEqual(received.at(-1), {});
  });
}

test("an immediate onChange can destroy its controller before registration", (t) => {
  const target = bind(t, droppable, { type: "food" });
  let calls = 0;
  target.controller.update({
    type: "food",
    onChange() {
      calls++;
      target.controller.destroy();
    },
  });
  const source = bind(t, draggable, { type: "food" });
  send(source.element, "dragstart");
  flushFrames();
  assert.equal(calls, 1);
  assert.deepEqual(target.controller.getSnapshot(), {});
});


for (const factory of [draggable, dragDroppable]) {
  test(`${factory.name}: callback lifecycle and unchanged state`, (t) => {
    const received = [];
    const onChange = (state) => received.push(state);
    const { controller, element } = bind(t, factory, { type: "food", onChange });
    assert.deepEqual(received, [{ dragging: false }]);
    controller.update((options) => ({ ...options }));
    assert.equal(received.length, 1);
    send(element, "dragstart");
    flushFrames();
    assert.equal(received.at(-1).dragging, true);
    const replacementStates = [];
    const replacement = (state) => replacementStates.push(state);
    controller.update({ type: "food", onChange: replacement });
    assert.equal(replacementStates.length, 0);
    const oldCount = received.length;
    send(element, "dragend");
    assert.equal(replacementStates.at(-1).dragging, false);
    assert.equal(received.length, oldCount);
    controller.update({ type: "food" });
    const count = replacementStates.length;
    send(element, "dragstart");
    send(element, "dragend");
    assert.equal(replacementStates.length, count);
    controller.update(null);
    controller.update({ type: "food", onChange: replacement });
    assert.equal(replacementStates.length, count + 1);
  });

  test(`${factory.name}: initial callback can replace options`, (t) => {
    const { controller, element } = bind(t, factory, { type: "food" });
    const received = [];
    controller.update({
      type: "obsolete",
      onChange: () => controller.update({
        type: "current", onChange: (state) => received.push(state),
      }),
    });
    assert.equal(element.attributes.get("data-dnd-draggable-type"), "current");
    assert.equal(received.length, 0);
    send(element, "dragstart");
    assert.equal(received.length, 1);
  });

  for (const operation of ["destroy", "unbind"]) {
    test(`${factory.name}: ${operation} reports reset and allows callback cleanup`, (t) => {
      const received = [];
      const { controller, element } = bind(t, factory, {
        type: "food", onChange: (state) => received.push(state),
      });
      send(element, "dragstart");
      flushFrames();
      assert.equal(received.at(-1).dragging, true);
      controller[operation]();
      assert.equal(received.at(-1).dragging, false);
      const count = received.length;
      controller[operation]();
      assert.equal(received.length, count);
    });
  }

  test(`${factory.name}: initial callback can destroy the controller`, (t) => {
    const { controller, element } = bind(t, factory, { type: "food" });
    controller.update({ type: "food", onChange: () => controller.destroy() });
    assert.equal(element.hasAttribute("draggable"), false);
    assert.equal(send(element, "dragstart").defaultPrevented, false);
    assert.equal(controller.getSnapshot().dragging, false);
  });
}

test("combined onChange observes target hover without reporting source dragging", (t) => {
  const received = [];
  const target = bind(t, dragDroppable, {
    type: "food", onChange: (state) => received.push(state),
  });
  const source = bind(t, draggable, { type: "food", data: "meal" });
  send(source.element, "dragstart");
  flushFrames();
  send(target.element, "dragover");
  assert.equal(received.at(-1).accepts, true);
  assert.equal(received.at(-1).drag, "meal");
  assert.equal(received.at(-1).dragging, false);
  const count = received.length;
  send(target.element, "dragover");
  assert.equal(received.length, count);
  target.controller.destroy();
  assert.deepEqual(received.at(-1), { dragging: false });
});

for (const action of [dndDrag, dndDrop, dnd]) {
  test(`${action.name}: direct options forward onChange`, (t) => {
    const received = [];
    const element = new TestElement();
    const binding = action(element, {
      type: "food", onChange: (state) => received.push(state),
    });
    t.after(() => binding.destroy());
    assert.equal(received.length, 1);
    if (action === dndDrop) {
      const source = bind(t, draggable, { type: "food" });
      send(source.element, "dragstart");
      flushFrames();
      send(element, "dragover");
      assert.equal(received.at(-1).accepts, true);
    } else {
      send(element, "dragstart");
      assert.equal(received.at(-1).dragging, true);
    }
    binding.destroy();
    assert.equal(!!received.at(-1).dragging, false);
  });
}

for (const factory of [draggable, droppable, dragDroppable]) {
  test(`${factory.name}: inline callback replacement is silent and the latest callback receives changes`, (t) => {
    const first = [];
    const latest = [];
    const { controller, element } = bind(t, factory, {
      type: "food", onChange: (state) => first.push(state),
    });
    assert.equal(first.length, 1);
    for (let i = 0; i < 3; i++) {
      controller.update({ type: "food", onChange: (state) => latest.push([i, state]) });
    }
    assert.deepEqual(latest, []);
    const source = factory !== draggable
      ? bind(t, draggable, { type: "food" })
      : { element };
    send(source.element, "dragstart");
    flushFrames();
    assert.equal(first.length, 1);
    assert.equal(latest.length, 1);
    assert.equal(latest[0][0], 2);
    assert.equal(latest[0][1], controller.getSnapshot());
    controller.update({ type: "food" });
    const reactivated = [];
    controller.update({ type: "food", onChange: (state) => reactivated.push(state) });
    assert.deepEqual(reactivated, [controller.getSnapshot()]);
    send(source.element, "dragend");
    assert.equal(reactivated.length, 2);
    assert.equal(latest.length, 1);
  });

  test(`${factory.name}: replacing onChange from a notification does not recurse`, (t) => {
    const { controller, element } = bind(t, factory, { type: "food" });
    const first = [];
    const next = [];
    controller.update({
      type: "food",
      onChange(state) {
        first.push(state);
        controller.update({ type: "food", onChange: (value) => next.push(value) });
      },
    });
    assert.equal(first.length, 1);
    assert.equal(next.length, 0);
    const source = factory !== draggable
      ? bind(t, draggable, { type: "food" })
      : { element };
    send(source.element, "dragstart");
    flushFrames();
    assert.equal(next.length, 1);
    send(source.element, "dragend");
    assert.equal(first.length, 1);
    assert.equal(next.length, 2);
  });
}
