import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement as h, StrictMode, useState } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Element: dom.window.Element,
  HTMLCanvasElement: dom.window.HTMLCanvasElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
let nextFrame = 0;
const frames = new Map();
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++nextFrame, callback);
  return nextFrame;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
  left: 0,
  top: 0,
  width: 100,
  height: 100,
});
const { createRoot } = await import("react-dom/client");
const { useDraggable, useDroppable } = await import("../src/react.js");
const { configureDnD } = await import("../src/index.js");

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));
afterEach(() => frames.clear());

function mount(t, App, props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function render(nextProps) {
    act(() => root.render(h(StrictMode, null, h(App, nextProps))));
  }
  t.after(() => {
    const elements = [
      ...container.querySelectorAll("[data-source], [data-target]"),
    ];
    act(() => root.unmount());
    for (const element of elements) {
      assert.equal(element.hasAttribute("draggable"), false);
      assert.equal(
        [...element.attributes].some((attribute) =>
          attribute.name.startsWith("data-dnd-"),
        ),
        false,
      );
    }
    container.remove();
    assert.equal(document.body.children.length, 0);
  });
  render(props);
  return { container, render };
}

function send(element, type, properties = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    clientX: 25,
    clientY: 25,
    dataTransfer: { setDragImage() {} },
    ...properties,
  });
  act(() => {
    element.dispatchEvent(event);
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback());
  });
  return event;
}

function pair(t, settings = {}, props = {}) {
  let source,
    target,
    renders = 0;
  function App({ hunger = 6, onDrop = () => {}, alternate = false }) {
    renders++;
    assert.ok(renders < 40, "store notifications caused a render loop");
    source = useDraggable({ type: "food", data: { quality: 2 } }, settings);
    target = useDroppable(
      {
        types: ["food"],
        data: { hunger },
        when: ({ drop }) => drop.hunger > 0,
        onDrop,
      },
      settings,
    );
    return h(
      "section",
      null,
      h(
        "div",
        { ref: source.ref, "data-source": "" },
        String(source.state.dragging),
      ),
      h(
        alternate ? "article" : "div",
        { ref: target.ref, "data-target": "" },
        String(target.state.canDrop),
      ),
    );
  }
  const mounted = mount(t, App, props);
  return {
    ...mounted,
    get source() {
      return source;
    },
    get target() {
      return target;
    },
    get renders() {
      return renders;
    },
    sourceEl: () => mounted.container.querySelector("[data-source]"),
    targetEl: () => mounted.container.querySelector("[data-target]"),
  };
}

test("hooks bind in Strict Mode, observe drag state and clean up on unmount", (t) => {
  const mounted = pair(t);
  assert.equal(mounted.sourceEl().getAttribute("draggable"), "true");
  send(mounted.sourceEl(), "dragstart");
  assert.equal(mounted.source.state.dragging, true);
  assert.equal(mounted.target.state.concerned, true);
  send(mounted.targetEl(), "dragover");
  assert.equal(mounted.target.state.canDrop, true);
  assert.equal(mounted.target.state.drop.hunger, 6);
  const element = mounted.targetEl();
  mounted.render({ alternate: true });
  assert.notEqual(element, mounted.targetEl());
  assert.equal(element.hasAttribute("data-dnd-droppable"), false);
  assert.equal(mounted.target.state.canDrop, false);
  send(mounted.targetEl(), "dragover");
  assert.equal(mounted.target.state.canDrop, true);
  send(mounted.sourceEl(), "dragend");
  assert.equal(mounted.source.state.dragging, false);
  assert.deepEqual(mounted.target.state, {});
});

test("inline data, arrays and callbacks do not loop or reset an accepted hover", (t) => {
  const received = [];
  const mounted = pair(t, {}, { onDrop: () => received.push("old") });
  send(mounted.sourceEl(), "dragstart");
  send(mounted.targetEl(), "dragover", { clientY: 75 });
  const controller = mounted.target.controller;
  const ref = mounted.target.ref;
  mounted.render({
    hunger: 3,
    onDrop: (args) => received.push(args.drop.hunger),
  });
  assert.equal(mounted.target.controller, controller);
  assert.equal(mounted.target.ref, ref);
  assert.equal(mounted.target.state.canDrop, true);
  assert.equal(mounted.target.state.y, 75);
  assert.equal(mounted.target.state.drop.hunger, 3);
  send(mounted.targetEl(), "drop", { clientY: 75 });
  assert.deepEqual(received, [3]);
  send(mounted.sourceEl(), "dragend");
});

test("committed props refresh acceptance and disabled sources", (t) => {
  let source, target;
  function App({ disabled = false, hunger = 6 }) {
    source = useDraggable({ type: "food", disabled });
    target = useDroppable({
      type: "food",
      data: { hunger },
      when: ({ drop }) => drop.hunger > 0,
    });
    return h(
      "section",
      null,
      h("div", { ref: source.ref, id: "source" }),
      h("div", { ref: target.ref, id: "target" }),
    );
  }
  const mounted = mount(t, App);
  const sourceEl = mounted.container.querySelector("#source");
  const targetEl = mounted.container.querySelector("#target");
  send(sourceEl, "dragstart");
  send(targetEl, "dragover");
  mounted.render({ hunger: 0 });
  assert.equal(target.state.unconcerned, true);
  assert.equal(target.state.canDrop, false);
  assert.equal(target.state.x, undefined);
  mounted.render({ hunger: 2 });
  assert.equal(target.state.concerned, true);
  send(targetEl, "dragover");
  assert.equal(target.state.canDrop, true);
  mounted.render({ disabled: true, hunger: 2 });
  assert.equal(source.state.dragging, false);
  assert.equal(sourceEl.hasAttribute("draggable"), false);
  assert.deepEqual(target.state, {});
});

test("subscribe:false keeps initial state without renders while data attributes update", (t) => {
  const received = [];
  const mounted = pair(
    t,
    { subscribe: false },
    { onDrop: (args) => received.push(args) },
  );
  const renders = mounted.renders;
  send(mounted.sourceEl(), "dragstart");
  send(mounted.targetEl(), "dragover");
  assert.equal(mounted.renders, renders);
  assert.equal(mounted.source.state.dragging, false);
  assert.deepEqual(mounted.target.state, {});
  assert.equal(mounted.targetEl().hasAttribute("data-dnd-can"), true);
  send(mounted.targetEl(), "drop");
  assert.equal(received.length, 1);
  assert.equal(received[0].drop.hunger, 6);
  send(mounted.sourceEl(), "dragend");
});

test("the subscription setting can change without replacing the controller", (t) => {
  let source, target;
  function App({ subscribe = false }) {
    source = useDraggable({ type: "food" }, { subscribe });
    target = useDroppable({ type: "food" }, { subscribe });
    return h(
      "section",
      null,
      h("div", { ref: source.ref, id: "source" }),
      h("div", { ref: target.ref, id: "target" }),
    );
  }
  const mounted = mount(t, App);
  const controller = target.controller;
  send(mounted.container.querySelector("#source"), "dragstart");
  send(mounted.container.querySelector("#target"), "dragover");
  assert.deepEqual(target.state, {});
  mounted.render({ subscribe: true });
  assert.equal(target.controller, controller);
  assert.equal(target.state.canDrop, true);
  mounted.render({ subscribe: false });
  assert.deepEqual(target.state, {});
  send(mounted.container.querySelector("#source"), "dragend");
});

test("detaching a hook element ends its participation and allows rebinding", (t) => {
  let result;
  function App({ visible = true }) {
    result = useDraggable({ type: "food" });
    return visible ? h("div", { ref: result.ref }) : null;
  }
  const mounted = mount(t, App);
  const old = mounted.container.firstChild;
  const controller = result.controller;
  send(old, "dragstart");
  mounted.render({ visible: false });
  assert.equal(old.hasAttribute("draggable"), false);
  assert.equal(result.state.dragging, false);
  mounted.render({ visible: true });
  assert.equal(result.controller, controller);
  assert.equal(mounted.container.firstChild.getAttribute("draggable"), "true");
});

test("drop callbacks can update React application state without feedback loops", (t) => {
  let source, target;
  let renders = 0;
  function Dinner() {
    assert.ok(++renders < 40, "application state triggered a render loop");
    const [hunger, setHunger] = useState(2);
    const [spoonfuls, setSpoonfuls] = useState(1);
    source = useDraggable({
      type: "food",
      data: { quality: 2 },
      disabled: spoonfuls <= 0,
    });
    target = useDroppable({
      type: "food",
      data: { hunger },
      when: ({ drop }) => drop.hunger > 0,
      onDrop: ({ drag }) => {
        setHunger((current) => Math.max(0, current - drag.quality));
        setSpoonfuls((current) => current - 1);
      },
    });
    return h(
      "section",
      null,
      h("div", { ref: source.ref, id: "meal" }, spoonfuls),
      h("div", { ref: target.ref, id: "baby" }, hunger),
    );
  }
  const mounted = mount(t, Dinner);
  const meal = mounted.container.querySelector("#meal");
  const baby = mounted.container.querySelector("#baby");
  send(meal, "dragstart");
  send(baby, "dragover");
  send(baby, "drop");
  assert.equal(meal.textContent, "0");
  assert.equal(baby.textContent, "0");
  assert.equal(meal.hasAttribute("draggable"), false);
  assert.equal(source.state.dragging, false);
  assert.deepEqual(target.state, {});
});

test("onChange observes source and target with React subscriptions disabled", (t) => {
  const sources = [];
  const targets = [];
  const onSourceChange = (state) => sources.push(state);
  const onTargetChange = (state) => targets.push(state);
  function App() {
    const source = useDraggable(
      { type: "food", onChange: onSourceChange },
      { subscribe: false },
    );
    const target = useDroppable(
      { type: "food", onChange: onTargetChange },
      { subscribe: false },
    );
    return h("section", null,
      h("div", { ref: source.ref, "data-source": "" }),
      h("div", { ref: target.ref, "data-target": "" }),
    );
  }
  const { container } = mount(t, App);
  send(container.querySelector("[data-source]"), "dragstart");
  assert.equal(sources.at(-1).dragging, true);
  send(container.querySelector("[data-target]"), "dragover");
  assert.equal(targets.at(-1).canDrop, true);
  send(container.querySelector("[data-source]"), "dragend");
  assert.equal(sources.at(-1).dragging, false);
  assert.deepEqual(targets.at(-1), {});
});
