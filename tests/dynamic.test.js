import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";
import { configureDnD, draggable, droppable } from "../src/index.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

function start(t, options = {}) {
  const source = bind(t, draggable, { type: "food", ...options });
  send(source.element, "dragstart");
  flushFrames();
  return source;
}

function observe(controller) {
  let state;
  const unsubscribe = controller.subscribe((value) => {
    state = value;
  });
  return {
    get state() {
      return state;
    },
    unsubscribe,
  };
}

test("a target added after drag start can accept a drop and is cleaned at drag end", (t) => {
  const food = { quality: 2 };
  const source = start(t, { data: food });
  let received;
  const baby = { hunger: 6 };
  const target = bind(t, droppable, {
    type: "food",
    data: baby,
    onDrop: (args) => {
      received = args;
    },
  });
  const snapshot = observe(target.controller);
  assert.equal(snapshot.state.dragging, true);
  assert.equal(snapshot.state.dragged, food);
  assert.equal(snapshot.state.canDrop, false);
  send(target.element, "drop");
  assert.equal(received, undefined);
  send(target.element, "dragover");
  send(target.element, "drop");
  assert.equal(received.dragged, food);
  assert.equal(received.drop, baby);
  send(source.element, "dragend");
  assert.deepEqual(snapshot.state, {});
  assert.equal(send(target.element, "dragover").defaultPrevented, false);
  const afterEnd = bind(t, droppable, { type: "food" });
  assert.deepEqual(observe(afterEnd.controller).state, {});
});

for (const operation of ["disable", "unbind"]) {
  test(`a target can ${operation} and rejoin the same drag`, (t) => {
    let drops = 0;
    const target = bind(t, droppable, {
      type: "food",
      onDrop: () => {
        drops++;
      },
    });
    const snapshot = observe(target.controller);
    const source = start(t);
    send(target.element, "dragover");
    assert.equal(snapshot.state.canDrop, true);
    if (operation === "disable")
      target.controller.update((current) => ({ ...current, disabled: true }));
    else target.controller.unbind();
    assert.deepEqual(snapshot.state, {});
    assert.equal(send(target.element, "dragover").defaultPrevented, false);
    if (operation === "disable")
      target.controller.update((current) => ({ ...current, disabled: false }));
    else target.controller.bind(target.element);
    assert.equal(snapshot.state.dragging, true);
    assert.equal(snapshot.state.canDrop, false);
    send(target.element, "dragover");
    send(target.element, "drop");
    assert.equal(drops, 1);
    send(source.element, "dragend");
    assert.deepEqual(snapshot.state, {});
    assert.equal(target.element.hasAttribute("data-dnd-concerned"), false);
  });
}

for (const [field, initial, matching] of [
  ["type", "toy", "food"],
  ["namespace", "B", "A"],
]) {
  test(`changing ${field} can make an existing target join or leave the current drag`, (t) => {
    const target = bind(t, droppable, {
      type: "food",
      namespace: "A",
      [field]: initial,
    });
    const snapshot = observe(target.controller);
    const source = start(t, { namespace: "A" });
    assert.deepEqual(snapshot.state, {});
    target.controller.update((current) => ({ ...current, [field]: matching }));
    assert.equal(snapshot.state.concerned, true);
    assert.equal(send(target.element, "dragover").defaultPrevented, true);
    target.controller.update((current) => ({ ...current, [field]: initial }));
    assert.deepEqual(snapshot.state, {});
    assert.equal(send(target.element, "dragover").defaultPrevented, false);
    send(source.element, "dragend");
  });
}

test("data and predicate updates re-evaluate acceptance using both payloads", (t) => {
  const food = { quality: 2 };
  let context;
  const target = bind(t, droppable, {
    type: "food",
    namespace: "A",
    data: { hunger: 0 },
    when: (dragged, args) => {
      assert.equal(dragged, food);
      context = args;
      return args.drop.hunger > 0;
    },
  });
  const snapshot = observe(target.controller);
  const source = start(t, { namespace: "A", data: food });
  assert.equal(snapshot.state.unconcerned, true);
  const baby = { hunger: 6 };
  target.controller.update((current) => ({ ...current, data: baby }));
  assert.deepEqual(context, {
    dragged: food,
    drop: baby,
    namespace: "A",
    type: "food",
  });
  assert.equal(context.drop, baby);
  assert.equal(snapshot.state.concerned, true);
  assert.equal(target.element.style.cursor, "");
  target.controller.update((current) => ({
    ...current,
    unless: { food: () => true },
  }));
  assert.equal(snapshot.state.unconcerned, true);
  target.controller.update((current) => ({
    ...current,
    unless: () => false,
    when: { food: () => false },
  }));
  assert.equal(snapshot.state.unconcerned, true);
  target.controller.update((current) => ({
    ...current,
    when: { food: () => true },
  }));
  assert.equal(snapshot.state.concerned, true);
  send(source.element, "dragend");
  assert.deepEqual(snapshot.state, {});
  assert.equal(target.element.style.cursor, "");
});

test("updating onDrop preserves hover and uses the new callback without movement", (t) => {
  const calls = [];
  const target = bind(t, droppable, {
    type: "food",
    onDrop: () => calls.push("old"),
  });
  const snapshot = observe(target.controller);
  const source = start(t);
  send(target.element, "dragover");
  target.controller.update((current) => ({
    ...current,
    onDrop: { food: () => calls.push("new") },
  }));
  assert.equal(snapshot.state.canDrop, true);
  assert.equal(snapshot.state.x, 25);
  send(target.element, "drop");
  assert.deepEqual(calls, ["new"]);
  send(source.element, "dragend");
  assert.deepEqual(snapshot.state, {});
});

test("position attributes follow hover and position fields clear on leave and drop", (t) => {
  let received;
  const target = bind(t, droppable, {
    type: "food",
    attributesPrefix: "custom",
    onDrop: (args) => {
      received = args;
    },
  });
  const snapshot = observe(target.controller);
  const source = start(t);
  const positionKeys = ["x", "y", "dx", "dy", "top", "bottom", "left", "right"];
  function assertCleared() {
    for (const key of positionKeys)
      assert.equal(Object.hasOwn(snapshot.state, key), false, key);
    for (const key of ["top", "bottom", "left", "right", "can"]) {
      assert.equal(
        target.element.hasAttribute(`data-custom-${key}`),
        false,
        key,
      );
    }
    assert.equal(snapshot.state.canDrop, null);
    assert.equal(snapshot.state.concerned, true);
  }
  for (const [clientX, clientY] of [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ]) {
    send(target.element, "dragover", { clientX, clientY });
    for (const [side, expected] of Object.entries({
      left: clientX < 50,
      right: clientX >= 50,
      top: clientY < 50,
      bottom: clientY >= 50,
    })) {
      assert.equal(
        target.element.hasAttribute(`data-custom-${side}`),
        expected,
        side,
      );
    }
    send(target.element, "dragleave");
    assertCleared();
    /* Returning at identical coordinates must restore position and attributes. */
    send(target.element, "dragover", { clientX, clientY });
    assert.equal(snapshot.state.x, clientX);
    assert.equal(snapshot.state.y, clientY);
    send(target.element, "drop", { clientX, clientY });
    assert.equal(received.x, clientX);
    assert.equal(received.y, clientY);
    assertCleared();
  }
  send(source.element, "dragend");
  assert.deepEqual(snapshot.state, {});
});

for (const factory of [draggable, droppable]) {
  test(`${factory.name}: update replaces options and receives a shallow copy`, (t) => {
    const data = { value: 1 };
    const { controller, element } = bind(t, factory, { type: "initial", data });
    controller.update((current) => {
      assert.equal(current.data, data);
      return { ...current, type: "changed" };
    });
    controller.update({ type: "replacement" });
    controller.update((current) => {
      assert.deepEqual(current, { type: "replacement" });
      return null;
    });
    assert.equal(element.attributes.size, 0);
    controller.update((current) => {
      assert.deepEqual(current, { disabled: true });
      return { type: "enabled" };
    });
    assert.equal(element.hasAttribute(`data-dnd-${factory.name}`), true);
  });
}

for (const change of [
  "data",
  "types",
  "predicates",
  "default namespace",
  "prefix",
]) {
  test(`updating ${change} preserves an accepted hover and uses current drop data`, (t) => {
    const food = { quality: 2 };
    const baby = { hunger: 6 };
    let received;
    const target = bind(t, droppable, {
      type: "food",
      data: baby,
      when: (_, { drop }) => drop.hunger > 0,
      onDrop: (args) => {
        received = args;
      },
    });
    const snapshot = observe(target.controller);
    const source = start(t, { data: food });
    send(target.element, "dragover", { clientX: 75, clientY: 75 });
    const nextBaby = change === "data" ? { hunger: 3 } : baby;
    target.controller.update((current) => ({
      ...current,
      ...(change === "data" ? { data: nextBaby } : {}),
      ...(change === "types"
        ? { type: undefined, types: ["toy", "food"] }
        : {}),
      ...(change === "predicates"
        ? { when: { food: () => true }, unless: () => false }
        : {}),
      ...(change === "default namespace" ? { namespace: "" } : {}),
      ...(change === "prefix" ? { attributesPrefix: "custom" } : {}),
    }));
    assert.equal(snapshot.state.canDrop, true);
    assert.equal(snapshot.state.x, 75);
    assert.equal(snapshot.state.bottom, true);
    const prefix = change === "prefix" ? "custom" : "dnd";
    assert.equal(target.element.hasAttribute(`data-${prefix}-can`), true);
    assert.equal(target.element.hasAttribute(`data-${prefix}-bottom`), true);
    if (change === "prefix") {
      assert.equal(
        [...target.element.attributes.keys()].some((key) =>
          key.startsWith("data-dnd-"),
        ),
        false,
      );
    }
    send(target.element, "drop", { clientX: 75, clientY: 75 });
    assert.equal(received.dragged, food);
    assert.equal(received.drop, nextBaby);
    send(source.element, "dragend");
    assert.deepEqual(snapshot.state, {});
    assert.equal(target.element.hasAttribute(`data-${prefix}-can`), false);
  });
}

test("a target becoming refused clears hover, and becoming accepted requires another dragover", (t) => {
  let drops = 0;
  const target = bind(t, droppable, {
    type: "food",
    data: { hunger: 6 },
    when: (_, { drop }) => drop.hunger > 0,
    onDrop: () => {
      drops++;
    },
  });
  const snapshot = observe(target.controller);
  const source = start(t);
  send(target.element, "dragover");
  target.controller.update((current) => ({ ...current, data: { hunger: 0 } }));
  assert.equal(snapshot.state.unconcerned, true);
  assert.equal(snapshot.state.x, undefined);
  assert.equal(target.element.hasAttribute("data-dnd-can"), false);
  assert.equal(target.element.style.cursor, "not-allowed");
  send(target.element, "drop");
  assert.equal(drops, 0);
  target.controller.update((current) => ({ ...current, data: { hunger: 2 } }));
  assert.equal(snapshot.state.concerned, true);
  assert.equal(snapshot.state.canDrop, false);
  assert.equal(target.element.style.cursor, "");
  send(target.element, "drop");
  assert.equal(drops, 0);
  send(target.element, "dragover");
  send(target.element, "drop");
  assert.equal(drops, 1);
  send(source.element, "dragend");
});

test("changing the actual target clears hover and moves DOM listeners", (t) => {
  const nextTarget = new TestElement();
  let drops = 0;
  const target = bind(t, droppable, {
    type: "food",
    onDrop: () => {
      drops++;
    },
  });
  const snapshot = observe(target.controller);
  const source = start(t);
  send(target.element, "dragover");
  target.controller.update((current) => ({ ...current, target: nextTarget }));
  assert.equal(snapshot.state.canDrop, false);
  assert.equal(snapshot.state.x, undefined);
  assert.equal(send(target.element, "dragover").defaultPrevented, false);
  send(nextTarget, "drop");
  assert.equal(drops, 0);
  send(nextTarget, "dragover");
  send(nextTarget, "drop");
  assert.equal(drops, 1);
  send(source.element, "dragend");
  assert.equal(send(nextTarget, "dragover").defaultPrevented, false);
});

test("adding and removing onDrop while hovering is effective without movement", (t) => {
  let drops = 0;
  const target = bind(t, droppable, { type: "food" });
  const source = start(t);
  send(target.element, "dragover");
  target.controller.update((current) => ({
    ...current,
    onDrop: () => {
      drops++;
    },
  }));
  assert.equal(send(target.element, "drop").defaultPrevented, true);
  assert.equal(drops, 1);
  send(target.element, "dragover");
  target.controller.update((current) => ({ ...current, onDrop: undefined }));
  assert.equal(send(target.element, "drop").defaultPrevented, false);
  assert.equal(drops, 1);
  send(source.element, "dragend");
});

for (const operation of ["disable", "unbind", "destroy"]) {
  test(`onDrop can ${operation} its own target without reviving stale state`, (t) => {
    let target;
    target = bind(t, droppable, {
      type: "food",
      onDrop: () => {
        if (operation === "disable")
          target.controller.update((current) => ({
            ...current,
            disabled: true,
          }));
        else target.controller[operation]();
      },
    });
    const snapshot = observe(target.controller);
    const source = start(t);
    send(target.element, "dragover");
    send(target.element, "drop");
    assert.deepEqual(snapshot.state, {});
    assert.equal(send(target.element, "dragover").defaultPrevented, false);
    send(source.element, "dragend");
  });
}

test("updating callbacks from a subscriber does not cause repeated state notifications", (t) => {
  const target = bind(t, droppable, { type: "food" });
  let notifications = 0;
  target.controller.subscribe((state) => {
    if (!state.dragging) return;
    notifications++;
    assert.ok(notifications <= 2, "unchanged state was published again");
    target.controller.update((current) => ({
      ...current,
      types: ["food"],
      onDrop: () => {},
    }));
  });
  const source = start(t);
  send(target.element, "dragover");
  assert.equal(notifications, 2);
  send(source.element, "dragend");
});

for (const operation of ["disable", "unbind", "destroy"]) {
  test(`an acceptance predicate can ${operation} its target during refresh`, (t) => {
    let cancel = false;
    let target;
    target = bind(t, droppable, {
      type: "food",
      when: () => {
        if (cancel) {
          if (operation === "disable")
            target.controller.update({ disabled: true });
          else target.controller[operation]();
        }
        return true;
      },
    });
    const snapshot = observe(target.controller);
    const source = start(t);
    send(target.element, "dragover");
    cancel = true;
    target.controller.update((current) => ({ ...current }));
    assert.deepEqual(snapshot.state, {});
    assert.equal(send(target.element, "dragover").defaultPrevented, false);
    send(source.element, "dragend");
    assert.deepEqual(snapshot.state, {});
  });
}

test("a source onDrop still runs when the target has no callback", (t) => {
  let received;
  const target = bind(t, droppable, { type: "food", data: { hunger: 3 } });
  const source = start(t, {
    onDrop: (args) => {
      received = args;
    },
  });
  send(target.element, "dragover");
  assert.equal(send(target.element, "drop").defaultPrevented, true);
  assert.equal(received.drop.hunger, 3);
  send(source.element, "dragend");
});
