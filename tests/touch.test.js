import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  TestElement,
  document,
  bind,
  touch,
  flushFrames,
} from "./helpers/dom.js";
import { configureDnD, draggable, droppable } from "../src/index.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

function hold(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  return () => {
    t.mock.timers.tick(300);
    flushFrames();
  };
}

for (const [global, local, enabled] of [
  [false, true, false],
  [false, {}, false],
  [null, undefined, false],
  [null, true, true],
  [null, {}, true],
  [true, undefined, true],
  [true, false, false],
  [true, null, false],
]) {
  test(`touch global=${JSON.stringify(global)}, local=${JSON.stringify(local)}: ${enabled ? "starts" : "disabled"}`, (t) => {
    const finishHold = hold(t);
    configureDnD({ touch: global });
    let starts = 0;
    const { element } = bind(t, draggable, {
      type: "policy",
      touch: local,
      onDrag: () => {
        starts++;
      },
    });
    touch(element);
    finishHold();
    assert.equal(starts, enabled ? 1 : 0);
    touch(element, "touchend", 0);
  });
}

test("global settings changed after binding are used on the next gesture", (t) => {
  hold(t);
  let starts = 0;
  const { element } = bind(t, draggable, {
    type: "delay",
    onDrag: () => {
      starts++;
    },
  });
  configureDnD({ touch: { pressHold: 500 } });
  touch(element);
  t.mock.timers.tick(300);
  assert.equal(starts, 0);
  t.mock.timers.tick(200);
  assert.equal(starts, 1);
  touch(element, "touchend", 0);
});

test("movement before the hold cancels the candidate without blocking scrolling", (t) => {
  const finishHold = hold(t);
  let starts = 0;
  const { element } = bind(t, draggable, {
    type: "scroll",
    onDrag: () => {
      starts++;
    },
  });
  touch(element);
  assert.equal(touch(element, "touchmove", 1, 50).defaultPrevented, false);
  finishHold();
  assert.equal(starts, 0);
  assert.equal(element.style.userSelect, "text");
});

test("second finger during the hold prevents a drag from starting", (t) => {
  const finishHold = hold(t);
  let starts = 0;
  const { element } = bind(t, draggable, {
    type: "multitouch",
    onDrag: () => {
      starts++;
    },
  });
  touch(element);
  touch(element, "touchstart", 2);
  finishHold();
  assert.equal(starts, 0);
  assert.equal(element.style.userSelect, "text");
});

test("second finger during a drag ends it without a drop and allows another gesture", (t) => {
  const finishHold = hold(t);
  let starts = 0,
    ends = 0,
    drops = 0;
  const { element } = bind(t, draggable, {
    type: "cancel",
    onDrag: () => {
      starts++;
    },
    onDragEnd: () => {
      ends++;
    },
  });
  const { element: target } = bind(t, droppable, {
    type: "cancel",
    onDrop: () => {
      drops++;
    },
  });
  document.hitTarget = target;
  t.after(() => {
    document.hitTarget = null;
  });
  touch(element);
  finishHold();
  touch(element, "touchmove");
  touch(element, "touchstart", 2);
  assert.equal(ends, 1);
  assert.equal(drops, 0);
  assert.equal(document.body.children.length, 0);
  touch(element, "touchend", 0);
  touch(element);
  finishHold();
  assert.equal(starts, 2);
  touch(element, "touchcancel", 0);
  assert.equal(ends, 2);
  assert.equal(drops, 0);
});

for (const operation of ["disable", "destroy"]) {
  test(`source ${operation} cancels a pending hold`, (t) => {
    const finishHold = hold(t);
    let starts = 0;
    const { controller, element } = bind(t, draggable, {
      type: "removed",
      onDrag: () => {
        starts++;
      },
    });
    touch(element);
    if (operation === "disable")
      controller.update((current) => ({ ...current, disabled: true }));
    else controller.destroy();
    finishHold();
    assert.equal(starts, 0);
    assert.equal(element.style.userSelect, "text");
  });
}

test("a custom drag image is copied instead of the touch source", (t) => {
  const finishHold = hold(t);
  const image = new TestElement();
  image.setAttribute("data-model", "custom");
  const { element } = bind(t, draggable, { type: "image", dragEl: image });
  touch(element);
  finishHold();
  assert.equal(document.body.children.length, 1);
  assert.equal(
    document.body.children[0].attributes.get("data-model"),
    "custom",
  );
  touch(element, "touchend", 0);
  assert.equal(document.body.children.length, 0);
});
