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
    assert.throws(() => controller.set({ type: "other" }), /destroyed/);
    assert.throws(() => controller.patch({ disabled: false }), /destroyed/);
  });
}

test("source options refresh attributes and remove the previous prefix", (t) => {
  const { controller, element } = bind(t, draggable, {
    type: "task",
    namespace: "A",
  });
  controller.patch({
    attributesPrefix: "custom",
    type: "document",
    namespace: "B",
  });
  assert.equal(element.hasAttribute("data-dnd-draggable"), false);
  assert.equal(
    element.attributes.get("data-custom-draggable-type"),
    "document",
  );
  assert.equal(element.attributes.get("data-custom-draggable-namespace"), "B");
  controller.patch({ attributesPrefix: false });
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
  controller.patch({ namespace: "B", type: "other", data: { id: 2 } });
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
    if (operation === "disable") controller.patch({ disabled: true });
    else if (operation === "namespace") controller.patch({ namespace: "B" });
    else controller[operation]();
    assert.equal(send(element, "dragover").defaultPrevented, false);
    send(element, "drop");
    assert.equal(drops, 0);
    assert.equal(element.hasAttribute("data-custom-can"), false);
    const oldEnd = publishDrag({ namespace: "A", type: "task" });
    assert.equal(oldEnd, undefined);
    assert.doesNotThrow(() => {
      end();
      end();
    });
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
  assert.equal(received.dragged, data);
  assert.equal(received.bottom, true);
  assert.equal(received.dy, 0.75);
});

test("unsupported types are ignored; supported but refused sources are unconcerned", (t) => {
  const { element } = bind(t, droppable, { type: "task", when: () => false });
  assert.equal(publishDrag({ type: "document" }), undefined);
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
