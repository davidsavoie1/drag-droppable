import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { configureDnD, draggable, droppable, createSortable } from "../src/index.js";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));
const newFields = ["middle", "center", "before", "after", "swap"];

function start(t, source) {
  source ??= bind(t, draggable, { type: "item" }).element;
  send(source, "dragstart");
  flushFrames();
  return source;
}

for (const [x, y, middle, center] of [
  [50, 50, true, true], [10, 50, true, false], [90, 50, true, false],
  [50, 10, false, true], [50, 90, false, true], [10, 10, false, false],
  [-1, 50, false, false], [101, 50, false, false],
  [50, -1, false, false], [50, 101, false, false],
]) {
  test(`middle/center at (${x}, ${y}) stay inside both target axes`, (t) => {
    const calls = [];
    const target = bind(t, droppable, { type: "item", bottomTopThreshold: 0.2,
      leftRightThreshold: 0.2, when: (event) => { calls.push(event); return true; } });
    start(t);
    assert.equal(Object.hasOwn(calls[0], "middle"), false);
    send(target.element, "dragover", { clientX: x, clientY: y });
    const state = target.controller.getSnapshot();
    assert.equal(state.middle, middle);
    assert.equal(state.center, center);
    assert.equal(calls.at(-1).middle, middle);
    assert.equal(calls.at(-1).center, center);
    assert.equal(target.element.hasAttribute("data-dnd-middle"), middle);
    assert.equal(target.element.hasAttribute("data-dnd-center"), center);
  });
}

for (const threshold of [0, 0.2, 0.5]) {
  test(`neutral zones follow threshold ${threshold}`, (t) => {
    const target = bind(t, droppable, { type: "item", bottomTopThreshold: threshold,
      leftRightThreshold: threshold });
    start(t);
    send(target.element, "dragover", { clientX: 50, clientY: 50 });
    assert.equal(target.controller.getSnapshot().middle, threshold < 0.5);
    assert.equal(target.controller.getSnapshot().center, threshold < 0.5);
  });
}

test("neutral zones reach rejected states and predicates but not CSS attributes", (t) => {
  let received;
  const target = bind(t, droppable, { type: "item", bottomTopThreshold: 0.2, leftRightThreshold: 0.2,
    unless: { item: (event) => { received = event; return event.middle; } } });
  start(t);
  send(target.element, "dragover", { clientX: 50, clientY: 50 });
  assert.equal(received.middle, true);
  assert.equal(target.controller.getSnapshot().middle, true);
  assert.equal(target.controller.getSnapshot().accepts, false);
  assert.equal(target.element.hasAttribute("data-dnd-middle"), false);
  assert.equal(target.element.hasAttribute("data-dnd-center"), false);
});

function sortableList(t, settings = {}, options = {}) {
  const changes = [], states = [];
  const sortable = createSortable({ ...settings, onListChange: (...args) => changes.push(args) });
  const rows = ["A", "B", "C"].map((data, index) => {
    const element = new TestElement();
    const binding = sortable(element, { type: "item", data, index, bottomTopThreshold: 0.2,
      leftRightThreshold: 0.2, attributesPrefix: "foo", ...options,
      onChange: (state) => { if (data === "C") states.push(state); },
    });
    t.after(() => binding.destroy());
    return { element, binding };
  });
  return { rows, sortable, changes, states };
}

for (const horizontal of [false, true]) {
  test(`sortable ${horizontal ? "horizontal" : "vertical"} exposes intentions throughout callbacks and drop`, (t) => {
    const calls = [];
    const l = sortableList(t, { horizontal }, {
      when: { item: (event) => { calls.push(event); return true; } },
    });
    start(t, l.rows[0].element);
    assert.equal(newFields.some((field) => Object.hasOwn(calls[0], field)), false);
    const target = l.rows[2].element;
    for (const [position, intent] of [[10, "before"], [90, "after"], [50, "swap"]]) {
      const coords = horizontal ? { clientX: position, clientY: 50 } : { clientX: 50, clientY: position };
      send(target, "dragover", coords);
      const state = l.states.at(-1);
      for (const field of ["before", "after", "swap"]) {
        assert.equal(state[field], field === intent);
        assert.equal(calls.at(-1)[field], field === intent);
        assert.equal(target.hasAttribute(`data-foo-${field}`), field === intent);
      }
    }
    send(target, "drop", { clientX: 50, clientY: 50 });
    assert.equal(l.changes[0][1].swap, true);
    for (const field of newFields) {
      assert.equal(Object.hasOwn(l.states.at(-1), field), false);
      assert.equal(target.hasAttribute(`data-foo-${field}`), false);
    }
  });
}

for (const predicate of ["when", "unless"]) {
  test(`sortable ${predicate} can refuse before and recover at the same coordinates`, (t) => {
    let refuse = true, received;
    const l = sortableList(t, {}, {
      [predicate]: (event) => {
        received = event;
        const rejected = refuse && event.before === true;
        return predicate === "unless" ? rejected : !rejected;
      },
    });
    start(t, l.rows[0].element);
    const target = l.rows[2].element;
    send(target, "dragover", { clientY: 10 });
    assert.equal(received.before, true);
    assert.equal(l.states.at(-1).before, true);
    assert.equal(l.states.at(-1).accepts, false);
    assert.equal(target.hasAttribute("data-foo-before"), false);
    refuse = false;
    send(target, "dragover", { clientY: 10 });
    assert.equal(l.states.at(-1).accepts, true);
    assert.equal(target.hasAttribute("data-foo-before"), true);
  });
}

for (const operation of ["dragleave", "dragend", "destroy"]) {
  test(`sortable clears all position attributes on ${operation}`, (t) => {
    const l = sortableList(t);
    const source = start(t, l.rows[0].element);
    const target = l.rows[2];
    send(target.element, "dragover", { clientX: 50, clientY: 50 });
    assert.equal(target.element.hasAttribute("data-foo-swap"), true);
    if (operation === "destroy") target.binding.destroy();
    else send(operation === "dragend" ? source : target.element, operation);
    for (const field of newFields) assert.equal(target.element.hasAttribute(`data-foo-${field}`), false);
  });
}

test("changing a sortable prefix removes old intention attributes", (t) => {
  const l = sortableList(t);
  start(t, l.rows[0].element);
  const target = l.rows[2];
  send(target.element, "dragover", { clientY: 10 });
  target.binding.update({ type: "item", data: "C", index: 2,
    attributesPrefix: "bar", bottomTopThreshold: 0.2, leftRightThreshold: 0.2 });
  assert.equal(target.element.hasAttribute("data-foo-before"), false);
  assert.equal(target.element.hasAttribute("data-bar-before"), true);
  target.binding.update({ type: "item", data: "C", index: 2, attributesPrefix: false });
  for (const field of newFields) assert.equal(target.element.hasAttribute(`data-bar-${field}`), false);
});

test("unusable rectangles omit all position fields instead of retaining previous intentions", (t) => {
  const l = sortableList(t);
  start(t, l.rows[0].element);
  const target = l.rows[2];
  send(target.element, "dragover", { clientX: 50, clientY: 50 });
  target.element.rect = { left: 0, top: 0, width: 0, height: 0 };
  send(target.element, "dragover");
  for (const field of newFields) {
    assert.equal(Object.hasOwn(l.states.at(-1), field), false);
    assert.equal(target.element.hasAttribute(`data-foo-${field}`), false);
  }
  send(target.element, "drop");
  assert.equal(l.changes.length, 0);
});

test("outside the target middle, center and swap are false", (t) => {
  const l = sortableList(t);
  start(t, l.rows[0].element);
  send(l.rows[2].element, "dragover", { clientX: -1, clientY: 50 });
  for (const field of ["middle", "center", "swap"]) assert.equal(l.states.at(-1)[field], false);
});
