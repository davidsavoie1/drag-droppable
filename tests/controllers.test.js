import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";
import {
  configureDnD,
  draggable,
  droppable,
  dndDrag,
  dndDrop,
} from "../src/index.js";
import { publishDrag } from "../src/dndSubs.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

for (const factory of [draggable, droppable]) {
  test(`${factory.name}: unbind allows rebinding; destroy is terminal`, (t) => {
    const { controller } = bind(t, factory, { type: "lifecycle" });
    controller.unbind();
    controller.bind(new TestElement());
    controller.destroy();
    controller.destroy();
    controller.unbind();
    assert.throws(() => controller.bind(new TestElement()), /destroyed/);
    assert.throws(() => controller.update({ type: "other" }), /destroyed/);
    let updaterCalled = false;
    assert.throws(
      () =>
        controller.update(() => {
          updaterCalled = true;
          return { disabled: false };
        }),
      /destroyed/,
    );
    assert.equal(updaterCalled, false);
  });
}

test("source options refresh attributes and remove the previous prefix", (t) => {
  const { controller, element } = bind(t, draggable, {
    type: "task",
    namespace: "A",
  });
  controller.update((current) => ({
    ...current,

    attributesPrefix: "custom",
    type: "document",
    namespace: "B",
  }));
  assert.equal(element.hasAttribute("data-dnd-draggable"), false);
  assert.equal(
    element.attributes.get("data-custom-draggable-type"),
    "document",
  );
  assert.equal(element.attributes.get("data-custom-draggable-namespace"), "B");
  controller.update((current) => ({
    ...current,
    attributesPrefix: false,
  }));
  assert.equal(
    [...element.attributes.keys()].some((key) => key.startsWith("data-")),
    false,
  );
});

test("ending before the next frame never activates targets", (t) => {
  const { element } = bind(t, draggable, { type: "quick" });
  const { controller: target } = bind(t, droppable, { type: "quick" });
  let state;
  target.subscribe((value) => {
    state = value;
  });
  send(element, "dragstart");
  send(element, "dragend");
  flushFrames();
  assert.deepEqual(state, {});
});

test("end callback uses the source session even after options change", (t) => {
  const ended = [];
  const data = { id: 1 };
  const { controller, element } = bind(t, draggable, {
    namespace: "A",
    type: "task",
    data,
    onDragEnd: (...args) => ended.push(args),
  });
  send(element, "dragstart");
  controller.update((current) => ({
    ...current,
    namespace: "B",
    type: "other",
    data: { id: 2 },
  }));
  send(element, "dragend");
  send(element, "dragend");
  assert.deepEqual(ended, [[data, "task", "A"]]);
});

test("parent ignores a nested source event, including a cancelled child drag", (t) => {
  let parentStarts = 0;
  const { element: parent } = bind(t, draggable, {
    type: "outer",
    onDrag: () => {
      parentStarts++;
    },
  });
  const { element: child } = bind(t, draggable, {
    type: "inner",
    except: () => true,
  });
  const event = send(child, "dragstart");
  assert.equal(event.defaultPrevented, true);
  send(parent, "dragstart", { origin: child });
  assert.equal(parentStarts, 0);
  send(parent, "dragstart");
  assert.equal(parentStarts, 1);
});

test("native touch drag is blocked while native mouse drag still starts", (t) => {
  let starts = 0;
  const { element } = bind(t, draggable, {
    type: "input",
    touch: false,
    onDrag: () => {
      starts++;
    },
  });
  send(element, "pointerdown", { pointerType: "touch" });
  assert.equal(send(element, "dragstart").defaultPrevented, true);
  assert.equal(starts, 0);
  send(element, "pointerdown", { pointerType: "mouse" });
  assert.equal(send(element, "dragstart").defaultPrevented, false);
  assert.equal(starts, 1);
});

for (const action of [dndDrag, dndDrop]) {
  test(`${action.name} accepts reactive options and cleans up`, () => {
    const element = new TestElement();
    const binding = action(element, { type: "task" });
    try {
      assert.doesNotThrow(() =>
        binding.update({ type: "task", disabled: true }),
      );
      assert.equal(element.attributes.size, 0);
      binding.update({ type: "task" });
    } finally {
      binding.destroy();
    }
    assert.equal(element.attributes.size, 0);
  });
}

for (const operation of ["disable", "unbind", "destroy", "namespace"]) {
  test(`target ${operation} cleans an active session and its old namespace`, (t) => {
    let drops = 0;
    const { controller, element } = bind(t, droppable, {
      namespace: "A",
      type: "task",
      attributesPrefix: "custom",
      onDrop: () => {
        drops++;
      },
    });
    const end = publishDrag({ namespace: "A", type: "task", data: { id: 1 } });
    t.after(end);
    assert.equal(send(element, "dragover").defaultPrevented, true);
    if (operation === "disable")
      controller.update((current) => ({ ...current, disabled: true }));
    else if (operation === "namespace")
      controller.update((current) => ({ ...current, namespace: "B" }));
    else controller[operation]();
    assert.equal(send(element, "dragover").defaultPrevented, false);
    send(element, "drop");
    assert.equal(drops, 0);
    assert.equal(element.hasAttribute("data-custom-can"), false);
    assert.doesNotThrow(() => {
      end();
      end();
    });
    const oldEnd = publishDrag({ namespace: "A", type: "task" });
    t.after(oldEnd);
    assert.equal(send(element, "dragover").defaultPrevented, false);
  });
}

test("accepted drop supplies payload and lower-half positioning", (t) => {
  let received;
  const data = { id: 1 };
  const { element } = bind(t, droppable, {
    type: "position",
    onDrop: (args) => {
      received = args;
    },
  });
  const end = publishDrag({ type: "position", data });
  t.after(end);
  send(element, "dragover", { clientY: 75 });
  send(element, "drop", { clientY: 75 });
  assert.equal(received.drag, data);
  assert.equal(received.bottom, true);
  assert.equal(received.dy, 0.75);
});

test("unsupported types are ignored; supported but refused sources are unconcerned", (t) => {
  const { element } = bind(t, droppable, { type: "task", when: () => false });
  const endUnsupported = publishDrag({ type: "document" });
  endUnsupported();
  assert.equal(element.hasAttribute("data-dnd-unconcerned"), false);
  const end = publishDrag({ type: "task" });
  t.after(end);
  assert.equal(element.hasAttribute("data-dnd-unconcerned"), true);
  assert.equal(element.style.cursor, "not-allowed");
  end();
  assert.equal(element.style.cursor, "");
});

test("source and target attributes coexist and clean up independently", (t) => {
  const element = new TestElement();
  const { controller: source } = bind(
    t,
    draggable,
    { namespace: "source", type: "source" },
    element,
  );
  const { controller: target } = bind(
    t,
    droppable,
    { namespace: "target", type: "target" },
    element,
  );
  const end = publishDrag({ namespace: "target", type: "target" });
  t.after(end);
  assert.equal(element.attributes.get("data-dnd-draggable-type"), "source");
  assert.equal(element.attributes.get("data-dnd-dragged-type"), "target");
  end();
  target.destroy();
  assert.equal(
    element.attributes.get("data-dnd-draggable-namespace"),
    "source",
  );
  assert.equal(element.hasAttribute("data-dnd-dragged-type"), false);
  source.destroy();
  assert.equal(element.attributes.size, 0);
});

for (const operation of ["disable", "destroy"]) {
  test(`source ${operation} during target publication cleans every target`, (t) => {
    const { controller: source, element } = bind(t, draggable, {
      type: "publishing",
    });
    const targets = [
      bind(t, droppable, { type: "publishing" }),
      bind(t, droppable, { type: "publishing" }),
    ];
    const states = [];
    targets.forEach(({ controller }, index) => {
      controller.subscribe((state) => {
        states[index] = state;
      });
    });
    targets[0].controller.subscribe((state) => {
      if (!state.dragging) return;
      if (operation === "disable")
        source.update((current) => ({ ...current, disabled: true }));
      else source.destroy();
    });

    send(element, "dragstart");
    flushFrames();

    for (const [index, target] of targets.entries()) {
      assert.deepEqual(states[index], {});
      assert.equal(target.element.hasAttribute("data-dnd-concerned"), false);
      assert.equal(send(target.element, "dragover").defaultPrevented, false);
    }
  });
}

test("a source session replaced during target publication keeps its own cleanup", (t) => {
  const { element } = bind(t, draggable, { type: "replacement" });
  const { controller: target, element: targetEl } = bind(t, droppable, {
    type: "replacement",
  });
  let restarted = false;
  let targetState;
  target.subscribe((state) => {
    targetState = state;
    if (state.dragging && !restarted) {
      restarted = true;
      send(element, "dragend");
      send(element, "dragstart");
    }
  });

  send(element, "dragstart");
  flushFrames();
  assert.deepEqual(targetState, {});
  flushFrames();
  assert.equal(targetState.dragging, true);
  assert.equal(send(targetEl, "dragover").defaultPrevented, true);
  send(element, "dragend");
  assert.deepEqual(targetState, {});
  assert.equal(send(targetEl, "dragover").defaultPrevented, false);
});

test("onDragEnd errors stay visible without leaving targets active", (t) => {
  const failure = new Error("Application callback failed");
  let ends = 0;
  const { controller: source, element } = bind(t, draggable, {
    type: "end-error",
    onDragEnd: () => {
      ends++;
      throw failure;
    },
  });
  const { controller: target, element: targetEl } = bind(t, droppable, {
    type: "end-error",
  });
  let targetState;
  target.subscribe((state) => {
    targetState = state;
  });

  send(element, "dragstart");
  flushFrames();
  assert.equal(send(targetEl, "dragover").defaultPrevented, true);

  /* Use synchronous controller cleanup: DOM dispatch reports listener errors
   * separately instead of throwing them back to the dispatch caller. */
  assert.throws(
    () => source.unbind(),
    (error) => error === failure,
  );
  assert.deepEqual(targetState, {});
  assert.equal(targetEl.hasAttribute("data-dnd-concerned"), false);
  assert.equal(targetEl.hasAttribute("data-dnd-can"), false);
  assert.equal(send(targetEl, "dragover").defaultPrevented, false);
  source.destroy();
  assert.equal(ends, 1);
});

for (const factory of [draggable, droppable]) {
  test(`${factory.name}: snapshots are stable reads and match subscription state`, (t) => {
    const target = bind(t, factory, { type: "snapshot" });
    /* Methods can be passed directly to consumers without binding `this`. */
    const { getSnapshot } = target.controller;
    let notified;
    const unsubscribe = target.controller.subscribe((state) => {
      notified = state;
    });
    t.after(unsubscribe);
    const initial = getSnapshot();
    assert.equal(getSnapshot(), initial);
    assert.equal(initial, notified);
    let source;
    if (factory === draggable) source = target;
    else source = bind(t, draggable, { type: "snapshot" });
    send(source.element, "dragstart");
    flushFrames();
    const active = getSnapshot();
    assert.notEqual(active, initial);
    assert.equal(active.dragging, true);
    assert.equal(active, notified);
    assert.equal(getSnapshot(), active);
    assert.notEqual(initial.dragging, true);
    send(source.element, "dragend");
    const ended = getSnapshot();
    assert.notEqual(ended, active);
    assert.equal(ended, notified);
    assert.equal(getSnapshot(), ended);
    assert.equal(active.dragging, true);
  });
}

test("a droppable update that leaves state unchanged keeps the same snapshot", (t) => {
  const target = bind(t, droppable, { type: "snapshot" });
  const source = bind(t, draggable, { type: "snapshot" });
  send(source.element, "dragstart");
  flushFrames();
  send(target.element, "dragover");
  const snapshot = target.controller.getSnapshot();
  target.controller.update((current) => ({
    ...current,
    types: ["snapshot"],
    onDrop: () => {},
  }));
  assert.equal(target.controller.getSnapshot(), snapshot);
  send(source.element, "dragend");
});
