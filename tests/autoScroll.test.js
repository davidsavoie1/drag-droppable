import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  TestElement,
  document,
  bind,
  touch,
  flushFrames,
} from "./helpers/dom.js";
import startAutoScroll from "../src/autoScroll.js";
import { configureDnD, draggable, droppable } from "../src/index.js";

beforeEach(() => {
  configureDnD({ attributesPrefix: "dnd", touch: true });
  Object.assign(document.scrollingElement, {
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 400,
    scrollHeight: 600,
  });
  document.hitTarget = null;
});

function start(t, point, options = {}) {
  let updates = 0;
  const stop = startAutoScroll(
    document,
    () => point,
    {
      autoScroll: true,
      scrollSensitivity: 40,
      scrollSpeed: 300,
      ...options,
    },
    () => {
      updates++;
    },
  );
  t.after(stop);
  flushFrames();
  return {
    stop,
    get updates() {
      return updates;
    },
  };
}

for (const [axis, point, offset] of [
  ["vertical", { x: 200, y: 590 }, "scrollTop"],
  ["horizontal", { x: 390, y: 300 }, "scrollLeft"],
]) {
  test(`auto-scroll moves the page on the ${axis} axis without pointer movement`, (t) => {
    const page = document.scrollingElement;
    page.scrollWidth = 1200;
    page.scrollHeight = 1800;
    const scroll = start(t, point);
    flushFrames();
    const first = page[offset];
    assert.ok(first > 0);
    flushFrames();
    assert.ok(page[offset] > first);
    assert.equal(scroll.updates, 2);
    point.x = 200;
    point.y = 300;
    const stoppedAt = page[offset];
    flushFrames();
    assert.equal(page[offset], stoppedAt);
    scroll.stop();
    point.x = 390;
    point.y = 590;
    flushFrames();
    assert.equal(page[offset], stoppedAt);
  });
}

test("the nearest scrolling ancestor is preferred, then its parent at the boundary", (t) => {
  const page = document.scrollingElement;
  page.scrollHeight = 1800;
  const list = new TestElement();
  list.rect = { left: 0, top: 400, width: 400, height: 200 };
  list.clientHeight = 200;
  list.scrollHeight = 500;
  list.style.overflowY = "auto";
  document.hitTarget = list;
  start(t, { x: 200, y: 590 });
  flushFrames();
  assert.ok(list.scrollTop > 0);
  assert.equal(page.scrollTop, 0);
  list.scrollTop = 300;
  flushFrames();
  assert.equal(list.scrollTop, 300);
  assert.ok(page.scrollTop > 0);
});

test("hidden overflow is skipped and page limits stop further scroll notifications", (t) => {
  const page = document.scrollingElement;
  page.scrollHeight = 601;
  const list = new TestElement();
  list.rect = { left: 0, top: 400, width: 400, height: 200 };
  list.clientHeight = 200;
  list.scrollHeight = 500;
  list.style.overflowY = "hidden";
  document.hitTarget = list;
  const scroll = start(t, { x: 200, y: 590 });
  flushFrames();
  assert.equal(list.scrollTop, 0);
  assert.equal(page.scrollTop, 1);
  assert.equal(scroll.updates, 1);
  flushFrames();
  assert.equal(scroll.updates, 1);
});

test("top and left edges scroll backwards and pointer proximity controls speed", (t) => {
  const page = document.scrollingElement;
  page.scrollWidth = 1200;
  page.scrollHeight = 1800;
  page.scrollLeft = 100;
  page.scrollTop = 100;
  const point = { x: 30, y: 30 };
  start(t, point);
  flushFrames();
  const slower = 100 - page.scrollTop;
  assert.ok(slower > 0);
  assert.ok(page.scrollLeft < 100);
  const before = page.scrollTop;
  point.x = 5;
  point.y = 5;
  flushFrames();
  assert.ok(before - page.scrollTop > slower);
});

for (const options of [
  { autoScroll: false },
  { scrollSensitivity: 0 },
  { scrollSpeed: 0 },
]) {
  test(`auto-scroll can be disabled with ${JSON.stringify(options)}`, (t) => {
    document.scrollingElement.scrollHeight = 1800;
    const scroll = start(t, { x: 200, y: 590 }, options);
    flushFrames();
    assert.equal(document.scrollingElement.scrollTop, 0);
    assert.equal(scroll.updates, 0);
  });
}

function startTouch(t, options = {}) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const source = bind(t, draggable, { type: "food", touch: options });
  document.scrollingElement.scrollHeight = 1800;
  touch(source.element, "touchstart", 1, 200, 590);
  return {
    ...source,
    hold() {
      t.mock.timers.tick(300);
      flushFrames();
    },
  };
}

test("touch auto-scroll waits for activation, retargets the drop and keeps the image under the finger", (t) => {
  const first = bind(t, droppable, { type: "food", data: "first" });
  let received;
  const second = bind(t, droppable, {
    type: "food",
    data: "second",
    onDrop: (args) => {
      received = args;
    },
  });
  const originalHitTest = document.elementFromPoint;
  document.elementFromPoint = () =>
    document.scrollingElement.scrollTop > 0 ? second.element : first.element;
  t.after(() => {
    document.elementFromPoint = originalHitTest;
  });
  const source = startTouch(t);
  source.element.rect = { left: 150, top: 540, width: 100, height: 100 };
  flushFrames();
  assert.equal(document.scrollingElement.scrollTop, 0);
  source.hold();
  touch(source.element, "touchmove", 1, 200, 590);
  assert.equal(first.controller.getSnapshot().accepts, true);
  flushFrames();
  assert.ok(document.scrollingElement.scrollTop > 0);
  assert.equal(first.controller.getSnapshot().accepts, null);
  assert.equal(second.controller.getSnapshot().accepts, true);
  const image = document.body.children[0];
  assert.equal(image.style.position, "fixed");
  assert.equal(Number.parseFloat(image.style.top), 540);
  touch(source.element, "touchend", 0);
  assert.equal(received.drop, "second");
  const endedAt = document.scrollingElement.scrollTop;
  flushFrames();
  assert.equal(document.scrollingElement.scrollTop, endedAt);
  assert.equal(document.body.children.length, 0);
});

for (const operation of ["cancel", "second finger", "disable", "destroy"]) {
  test(`touch auto-scroll stops after ${operation}`, (t) => {
    const source = startTouch(t);
    source.hold();
    flushFrames();
    assert.ok(document.scrollingElement.scrollTop > 0);
    if (operation === "cancel") touch(source.element, "touchcancel", 0);
    else if (operation === "second finger")
      touch(source.element, "touchstart", 2);
    else if (operation === "disable")
      source.controller.update({ disabled: true });
    else source.controller.destroy();
    const endedAt = document.scrollingElement.scrollTop;
    flushFrames();
    flushFrames();
    assert.equal(document.scrollingElement.scrollTop, endedAt);
  });
}

test("a local autoScroll:false overrides the globally enabled touch auto-scroll", (t) => {
  const source = startTouch(t, { autoScroll: false });
  source.hold();
  flushFrames();
  flushFrames();
  assert.equal(document.scrollingElement.scrollTop, 0);
  touch(source.element, "touchend", 0);
});
