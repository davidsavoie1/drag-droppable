import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { configureDnD, draggable, droppable, dragDroppable, createSortable } from "../src/index.js";
import { classOptions } from "../src/classes.js";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", bottomTopThreshold: 0.2,
  leftRightThreshold: 0.2, ...Object.fromEntries(classOptions.map((key) => [key, null])) }));
const has = (el, name) => el.classList.contains(name);
function start(source) { send(source, "dragstart"); flushFrames(); }

test("global classes work without attributes and local false/null override them", (t) => {
  configureDnD({ attributesPrefix: false, classDraggable: "source shared", classDragging: "active" });
  const source = bind(t, draggable, { type: "item" });
  assert.equal(has(source.element, "source"), true);
  assert.equal(source.element.hasAttribute("data-dnd-draggable"), false);
  start(source.element);
  assert.equal(has(source.element, "active"), true);
  send(source.element, "dragend");
  assert.equal(has(source.element, "active"), false);
  source.controller.update({ type: "item", classDraggable: false, classDragging: null });
  assert.equal(has(source.element, "source"), false);
  start(source.element);
  assert.equal(has(source.element, "active"), false);
  send(source.element, "dragend");
});

test("position classes mirror accepted hover and update without a state change", (t) => {
  const source = bind(t, draggable, { type: "item" });
  let refused = false;
  const options = { type: "item", classDroppable: "target", classTop: "top shared",
    classLeft: "left shared", classAccepts: "yes", classConcerned: "concerned",
    classUnconcerned: "no", unless: () => refused };
  const target = bind(t, droppable, options);
  assert.equal(has(target.element, "target"), true);
  start(source.element);
  send(target.element, "dragover", { clientX: 10, clientY: 10 });
  for (const name of ["top", "left", "shared", "yes", "concerned"]) assert.equal(has(target.element, name), true);
  send(target.element, "dragover", { clientX: 10, clientY: 50 });
  assert.equal(has(target.element, "top"), false);
  assert.equal(has(target.element, "shared"), true);
  target.controller.update({ ...options, classLeft: "replacement" });
  assert.equal(has(target.element, "left"), false);
  assert.equal(has(target.element, "replacement"), true);
  refused = true;
  send(target.element, "dragover", { clientX: 10, clientY: 10 });
  for (const name of ["top", "replacement", "shared", "yes"]) assert.equal(has(target.element, name), false);
  assert.equal(has(target.element, "no"), true);
  refused = false;
  send(target.element, "drop", { clientX: 10, clientY: 10 });
  for (const name of ["top", "replacement", "shared"]) assert.equal(has(target.element, name), false);
  for (const [name, attr] of [["yes", "accepts"], ["no", "unconcerned"], ["concerned", "concerned"]]) {
    assert.equal(has(target.element, name), target.element.hasAttribute(`data-dnd-${attr}`));
  }
  send(source.element, "dragend");
  for (const name of ["yes", "no", "concerned"]) assert.equal(has(target.element, name), false);
});

for (const cleanup of ["unbind", "destroy", "disable"]) {
  test(`class ownership preserves existing classes and cleans up on ${cleanup}`, (t) => {
    const element = new TestElement();
    element.classList.add("existing");
    const source = draggable({ type: "item", classDraggable: "existing shared", classDragging: "active" });
    const target = droppable({ type: "item", classDroppable: "shared target" });
    source.bind(element); target.bind(element);
    t.after(() => { source.destroy(); target.destroy(); });
    start(element);
    if (cleanup === "disable") source.update({ disabled: true });
    else source[cleanup]();
    assert.equal(has(element, "existing"), true);
    assert.equal(has(element, "shared"), true);
    assert.equal(has(element, "active"), false);
    target.destroy();
    assert.equal(has(element, "shared"), false);
    assert.equal(has(element, "target"), false);
    assert.equal(has(element, "existing"), true);
  });
}

test("combined controllers forward classes and preserve shared role ownership", (t) => {
  const combined = bind(t, dragDroppable, { type: "item", classDraggable: "shared",
    classDroppable: "shared", classDragging: "active", attributesPrefix: false });
  assert.equal(has(combined.element, "shared"), true);
  start(combined.element);
  assert.equal(has(combined.element, "active"), true);
  send(combined.element, "dragend");
  assert.equal(has(combined.element, "active"), false);
  combined.controller.destroy();
  assert.equal(has(combined.element, "shared"), false);
});

test("sortable defaults expose intent classes and local options override them", (t) => {
  const sortable = createSortable({ type: "item", allowSwap: true, attributesPrefix: false,
    classBefore: "before", classAfter: "after", classSwap: "swap", bottomTopThreshold: 0.2 });
  const elements = ["A", "B", "C"].map((data, index) => {
    const el = new TestElement();
    const binding = sortable(el, { data, index, ...(index === 2 ? { classAfter: "local" } : {}) });
    t.after(() => binding.destroy());
    return el;
  });
  start(elements[0]);
  for (const [clientY, name] of [[10, "before"], [50, "swap"], [90, "local"]]) {
    send(elements[2], "dragover", { clientY });
    for (const candidate of ["before", "swap", "local", "after"]) assert.equal(has(elements[2], candidate), candidate === name);
  }
  send(elements[2], "dragleave");
  assert.equal(has(elements[2], "local"), false);
  send(elements[2], "dragover", { clientY: 10 });
  send(elements[0], "dragend");
  assert.equal(has(elements[2], "before"), false);
});


test("global class changes apply on stationary hover without notifying state subscribers", (t) => {
  configureDnD({ classTop: "old" });
  const source = bind(t, draggable, { type: "item" });
  let changes = 0;
  const target = bind(t, droppable, { type: "item", onChange: () => changes++ });
  start(source.element);
  send(target.element, "dragover", { clientY: 10 });
  assert.equal(has(target.element, "old"), true);
  const count = changes;
  configureDnD({ classTop: "new" });
  send(target.element, "dragover", { clientY: 10 });
  assert.equal(has(target.element, "old"), false);
  assert.equal(has(target.element, "new"), true);
  assert.equal(changes, count);
  send(source.element, "dragend");
  assert.equal(has(target.element, "new"), false);
});
