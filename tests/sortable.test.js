import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createSortable, configureDnD, draggable } from "../src/index.js";
import { TestElement, bind, send, flushFrames } from "./helpers/dom.js";

beforeEach(() => configureDnD({ attributesPrefix: "dnd", touch: true }));

function list(t, initial, options = {}, settings = {}) {
  const changes = [];
  const sortable = createSortable({ ...settings, dataToId: "id", onListChange: (...args) => changes.push(args) });
  const rows = new Map();
  function update(data) {
    for (const [id, row] of rows) {
      if (!data.some((value) => value.id === id)) {
        row.binding.destroy();
        rows.delete(id);
      }
    }
    data.forEach((datum, index) => {
      const config = { type: "item", data: datum, index, ...options };
      if (rows.has(datum.id)) rows.get(datum.id).binding.update(config);
      else {
        const element = new TestElement();
        const binding = sortable(element, config);
        rows.set(datum.id, { element, binding });
        t.after(() => binding.destroy());
      }
    });
  }
  update(initial);
  return { changes, rows, update, sortable };
}

function drop(source, target, bottom = true) {
  send(source, "dragstart");
  flushFrames();
  const position = typeof bottom === "object" ? bottom : { clientY: bottom ? 75 : 25 };
  send(target, "dragover", position);
  send(target, "drop", position);
  send(source, "dragend");
}

const data = () => ["A", "B", "C", "D"].map((id) => ({ id }));

test("sortable moves down repeatedly and back up after application updates", (t) => {
  const l = list(t, data());
  for (const [source, target, bottom, expected] of [
    ["A", "B", true, ["B", "A", "C", "D"]],
    ["A", "C", true, ["B", "C", "A", "D"]],
    ["A", "C", false, ["B", "A", "C", "D"]],
    ["A", "B", false, ["A", "B", "C", "D"]],
  ]) {
    drop(l.rows.get(source).element, l.rows.get(target).element, bottom);
    const [values, { ids }] = l.changes.at(-1);
    assert.deepEqual(ids, expected);
    assert.deepEqual(values.map((value) => value.id), expected);
    l.update(values);
  }
  assert.equal(l.changes.length, 4);
});

test("sortable proposes external insertions before and after without requiring a controller", (t) => {
  const l = list(t, data(), {}, { allowExternal: true });
  const incoming = { id: "X", extra: 42 };
  const source = bind(t, draggable, { type: "item", data: incoming });
  drop(source.element, l.rows.get("B").element, false);
  assert.deepEqual(l.changes[0][1].ids, ["A", "X", "B", "C", "D"]);
  assert.equal(l.changes[0][0][1], incoming);
  // No application update: the previous proposal must not alter internal order.
  drop(source.element, l.rows.get("C").element);
  assert.deepEqual(l.changes[1][1].ids, ["A", "B", "C", "X", "D"]);
  l.update(l.changes[1][0]);
  drop(l.rows.get("X").element, l.rows.get("A").element, false);
  assert.deepEqual(l.changes[2][1].ids, ["X", "A", "B", "C", "D"]);
});

test("sortable handles identity replacement at the same index", (t) => {
  const l = list(t, data());
  const row = l.rows.get("B");
  row.binding.update({ type: "item", data: { id: "X" }, index: 1 });
  drop(row.element, l.rows.get("C").element);
  assert.deepEqual(l.changes[0][1].ids, ["A", "C", "X", "D"]);
});

test("sortable order survives removing multiple rows and adding a new one", (t) => {
  const l = list(t, data());
  l.update([{ id: "D" }, { id: "X" }]);
  drop(l.rows.get("X").element, l.rows.get("D").element, false);
  assert.deepEqual(l.changes[0][1].ids, ["X", "D"]);
});

test("sortable ignores unchanged positions and external duplicate identities", (t) => {
  const l = list(t, data(), {}, { allowExternal: true });
  drop(l.rows.get("A").element, l.rows.get("B").element, false);
  drop(l.rows.get("B").element, l.rows.get("A").element);
  const source = bind(t, draggable, { type: "item", data: { id: "A" } });
  drop(source.element, l.rows.get("C").element);
  assert.equal(l.changes.length, 0);
});

test("mutating a proposed ids array does not change sortable order", (t) => {
  const l = list(t, data());
  drop(l.rows.get("A").element, l.rows.get("B").element);
  l.changes[0][1].ids.splice(0);
  drop(l.rows.get("D").element, l.rows.get("A").element, false);
  assert.deepEqual(l.changes[1][1].ids, ["D", "A", "B", "C"]);
});

test("sortable uses current registered data after options updates", (t) => {
  const l = list(t, data());
  const current = { id: "B", value: "updated" };
  l.update([{ id: "A" }, current, { id: "C" }, { id: "D" }]);
  drop(l.rows.get("B").element, l.rows.get("C").element);
  assert.equal(l.changes[0][0][2], current);
});

for (const operation of ["destroy target", "replace target", "remove source"]) {
  test(`sortable safely handles onDrop callbacks that ${operation}`, (t) => {
    const l = list(t, data());
    const target = l.rows.get("B");
    target.binding.update({ type: "item", data: { id: "B" }, index: 1,
      onDrop({ drag, drop: targetData }) {
        assert.equal(drag.id, "A");
        assert.equal(targetData.id, "B");
        if (operation === "destroy target") target.binding.destroy();
        if (operation === "replace target") {
          target.binding.update({ type: "item", data: { id: "X" }, index: 1 });
        }
        if (operation === "remove source") l.rows.get("A").binding.destroy();
      },
    });
    drop(l.rows.get("A").element, target.element);
    assert.equal(l.changes.length, 0);
  });
}

test("sortable inserts data from another sortable without removing it from its source", (t) => {
  const first = list(t, [{ id: "X" }]);
  const second = list(t, [{ id: "A" }, { id: "B" }], {}, { allowExternal: true });
  drop(first.rows.get("X").element, second.rows.get("A").element);
  assert.deepEqual(second.changes[0][1].ids, ["A", "X", "B"]);
  assert.equal(second.changes[0][0][1].id, "X");
  assert.equal(first.changes.length, 0);
});


for (const horizontal of [false, true]) {
  const coordinates = (position) => horizontal
    ? { clientX: position, clientY: 50 }
    : { clientX: 50, clientY: position };
  const options = { bottomTopThreshold: 0.2, leftRightThreshold: 0.2 };

  test(`sortable ${horizontal ? "horizontal" : "vertical"}: insertion on both edges and swap in center`, (t) => {
    const l = list(t, data(), options, { horizontal, allowSwap: true });
    for (const [source, target, position, expected] of [
      ["A", "C", 90, ["B", "C", "A", "D"]],
      ["A", "B", 10, ["A", "B", "C", "D"]],
      ["A", "D", 50, ["D", "B", "C", "A"]],
    ]) {
      drop(l.rows.get(source).element, l.rows.get(target).element, coordinates(position));
      const [values, { ids }] = l.changes.at(-1);
      assert.deepEqual(ids, expected);
      assert.deepEqual(values.map((value) => value.id), expected);
      l.update(values);
    }
    assert.equal(l.changes.length, 3);
  });

  test(`sortable ${horizontal ? "horizontal" : "vertical"}: neighbor edges are refused but center swap remains allowed`, (t) => {
    const l = list(t, data(), options, { horizontal, allowSwap: true });
    const source = l.rows.get("A").element;
    const target = l.rows.get("B").element;
    send(source, "dragstart");
    flushFrames();
    send(target, "dragover", coordinates(10));
    assert.equal(target.hasAttribute("data-dnd-accepts"), false);
    send(target, "dragover", coordinates(50));
    assert.equal(target.hasAttribute("data-dnd-accepts"), true);
    send(target, "drop", coordinates(50));
    send(source, "dragend");
    assert.deepEqual(l.changes[0][1].ids, ["B", "A", "C", "D"]);
  });

  test(`sortable ${horizontal ? "horizontal" : "vertical"}: external center is refused and an edge can accept it`, (t) => {
    const l = list(t, data(), options, { horizontal, allowExternal: true });
    const incoming = { id: "X" };
    const source = bind(t, draggable, { type: "item", data: incoming });
    const target = l.rows.get("B").element;
    send(source.element, "dragstart");
    flushFrames();
    send(target, "dragover", coordinates(50));
    assert.equal(target.hasAttribute("data-dnd-accepts"), false);
    send(target, "dragover", coordinates(10));
    assert.equal(target.hasAttribute("data-dnd-accepts"), true);
    send(target, "drop", coordinates(10));
    send(source.element, "dragend");
    assert.deepEqual(l.changes[0][1].ids, ["A", "X", "B", "C", "D"]);
    assert.equal(l.changes[0][0][1], incoming);
  });
}

for (const byType of [false, true]) {
  test(`sortable unless receives original data and current position (by type: ${byType})`, (t) => {
    const values = data();
    const calls = [];
    const predicate = (args) => {
      assert.equal(args.drag, values[0]);
      assert.equal(values.includes(args.drop), true);
      calls.push(args);
      return args.top;
    };
    const l = list(t, values, {
      bottomTopThreshold: 0.2,
      unless: byType ? { item: predicate } : predicate,
    });
    const source = l.rows.get("A").element;
    const target = l.rows.get("C").element;
    send(source, "dragstart");
    flushFrames();
    send(target, "dragover", { clientY: 10 });
    assert.equal(target.hasAttribute("data-dnd-accepts"), false);
    send(target, "dragover", { clientY: 90 });
    assert.equal(target.hasAttribute("data-dnd-accepts"), true);
    send(target, "drop", { clientY: 90 });
    send(source, "dragend");
    assert.ok(calls.some((args) => args.top));
    assert.ok(calls.some((args) => args.bottom));
    assert.deepEqual(l.changes[0][1].ids, ["B", "C", "A", "D"]);
  });
}

test("sortable ignores predicates for other types", (t) => {
  const l = list(t, data(), { unless: { other: () => { assert.fail("wrong predicate"); } } });
  drop(l.rows.get("A").element, l.rows.get("C").element);
  assert.deepEqual(l.changes[0][1].ids, ["B", "C", "A", "D"]);
});

test("sortable aborts center swap if onDrop removes the source", (t) => {
  const l = list(t, data(), { bottomTopThreshold: 0.2 }, { allowSwap: true });
  const target = l.rows.get("B");
  let drops = 0;
  target.binding.update({
    type: "item", index: 1, data: { id: "B" }, bottomTopThreshold: 0.2,
    onDrop({ drag, drop: targetData }) {
      assert.equal(drag.id, "A");
      assert.equal(targetData.id, "B");
      drops++;
      l.rows.get("A").binding.destroy();
    },
  });
  drop(l.rows.get("A").element, target.element, { clientY: 50 });
  assert.equal(drops, 1);
  assert.equal(l.changes.length, 0);
});


for (const horizontal of [false, true]) {
  for (const [flag, blocked] of [["noBefore", 10], ["noAfter", 90], ["allowSwap", 50]]) {
    test(`sortable ${horizontal ? "horizontal" : "vertical"}: ${flag} refuses only its zone`, (t) => {
      const l = list(t, data(), {
        bottomTopThreshold: 0.2, leftRightThreshold: 0.2,
      }, { horizontal, allowSwap: true, [flag]: flag !== "allowSwap" });
      const source = l.rows.get("A").element;
      const target = l.rows.get("C").element;
      const coordinates = (position) => horizontal
        ? { clientX: position, clientY: 50 }
        : { clientX: 50, clientY: position };
      send(source, "dragstart");
      flushFrames();
      for (const position of [10, 50, 90]) {
        send(target, "dragover", coordinates(position));
        assert.equal(target.hasAttribute("data-dnd-accepts"), position !== blocked);
      }
      send(target, "dragover", coordinates(blocked));
      send(target, "drop", coordinates(blocked));
      assert.equal(l.changes.length, 0);
      const allowed = blocked === 10 ? 90 : 10;
      send(target, "dragover", coordinates(allowed));
      send(target, "drop", coordinates(allowed));
      send(source, "dragend");
      assert.equal(l.changes.length, 1);
      assert.deepEqual(l.changes[0][1].ids, allowed === 90
        ? ["B", "C", "A", "D"] : ["B", "A", "C", "D"]);
    });
  }
}


test("sortable list context describes internal moves and preserves data references", (t) => {
  const values = data();
  const l = list(t, values);
  drop(l.rows.get("A").element, l.rows.get("C").element);
  const [next, context] = l.changes[0];
  assert.equal(context.drag, values[0]);
  assert.equal(context.drop, values[2]);
  assert.equal(context.dragIndex, 0);
  assert.equal(context.external, false);
  assert.equal(context.type, "item");
  assert.equal(context.bottom, true);
  assert.equal(context.y, 75);
  assert.deepEqual(context.ids, next.map((value) => value.id));
});

test("sortable list context distinguishes another sortable from an ordinary source", (t) => {
  const sourceList = list(t, [{ id: "W" }, { id: "X" }]);
  const target = list(t, [{ id: "A" }, { id: "B" }], {}, { allowExternal: true });
  drop(sourceList.rows.get("X").element, target.rows.get("A").element);
  const context = target.changes[0][1];
  assert.equal(context.external, true);
  assert.equal(context.dragIndex, 1);
  assert.equal(context.drag.id, "X");
  assert.deepEqual(context.ids, ["A", "X", "B"]);
  const incoming = { id: "Y" };
  const source = bind(t, draggable, { type: "item", data: incoming });
  drop(source.element, target.rows.get("B").element);
  const plainContext = target.changes[1][1];
  assert.equal(plainContext.external, true);
  assert.equal(plainContext.dragIndex, undefined);
  assert.equal(plainContext.drag, incoming);
});


for (const explicit of [false, true]) {
  for (const fromSortable of [false, true]) {
    test(`sortable refuses external drags (${explicit ? "explicit false" : "default"}, source sortable: ${fromSortable})`, (t) => {
      const target = list(t, data(), { bottomTopThreshold: 0.2 },
        explicit ? { allowExternal: false } : {});
      const source = fromSortable
        ? list(t, [{ id: "X" }]).rows.get("X")
        : bind(t, draggable, { type: "item", data: { id: "X" } });
      const element = target.rows.get("B").element;
      send(source.element, "dragstart");
      flushFrames();
      for (const clientY of [10, 50, 90]) {
        send(element, "dragover", { clientY });
        assert.equal(element.hasAttribute("data-dnd-accepts"), false);
        send(element, "drop", { clientY });
      }
      send(source.element, "dragend");
      assert.equal(target.changes.length, 0);
      // Internal moves remain available with external acceptance disabled.
      drop(target.rows.get("A").element, target.rows.get("C").element, { clientY: 90 });
      assert.deepEqual(target.changes[0][1].ids, ["B", "C", "A", "D"]);
    });
  }
}

test("allowExternal does not bypass position restrictions", (t) => {
  const target = list(t, data(), { bottomTopThreshold: 0.2 },
    { allowExternal: true, noBefore: true });
  const source = bind(t, draggable, { type: "item", data: { id: "X" } });
  const element = target.rows.get("B").element;
  send(source.element, "dragstart");
  flushFrames();
  send(element, "dragover", { clientY: 10 });
  assert.equal(element.hasAttribute("data-dnd-accepts"), false);
  send(element, "dragover", { clientY: 90 });
  assert.equal(element.hasAttribute("data-dnd-accepts"), true);
  send(element, "drop", { clientY: 90 });
  send(source.element, "dragend");
  assert.deepEqual(target.changes[0][1].ids, ["A", "B", "X", "C", "D"]);
});


for (const horizontal of [false, true]) {
  test(`allowReorder refuses internal insertions and swaps (${horizontal ? "horizontal" : "vertical"})`, (t) => {
    const l = list(t, data(), { bottomTopThreshold: 0.2, leftRightThreshold: 0.2 },
      { allowReorder: false, allowExternal: true, horizontal });
    const source = l.rows.get("A").element;
    const target = l.rows.get("C").element;
    send(source, "dragstart");
    flushFrames();
    for (const position of [10, 50, 90]) {
      const coords = horizontal ? { clientX: position, clientY: 50 }
        : { clientX: 50, clientY: position };
      send(target, "dragover", coords);
      assert.equal(target.hasAttribute("data-dnd-accepts"), false);
      send(target, "drop", coords);
    }
    send(source, "dragend");
    assert.equal(l.changes.length, 0);
  });
}

for (const fromSortable of [false, true]) {
  test(`allowReorder allows external insertions when enabled (source sortable: ${fromSortable})`, (t) => {
    const target = list(t, data(), {}, { allowReorder: false, allowExternal: true });
    const source = fromSortable ? list(t, [{ id: "X" }]).rows.get("X")
      : bind(t, draggable, { type: "item", data: { id: "X" } });
    drop(source.element, target.rows.get("B").element);
    assert.deepEqual(target.changes[0][1].ids, ["A", "B", "X", "C", "D"]);
    assert.equal(target.changes[0][1].external, true);
  });
}

test("allowReorder does not prevent dragging to another list", (t) => {
  const source = list(t, [{ id: "X" }], {}, { allowReorder: false });
  const target = list(t, data(), {}, { allowExternal: true });
  drop(source.rows.get("X").element, target.rows.get("B").element);
  assert.deepEqual(target.changes[0][1].ids, ["A", "B", "X", "C", "D"]);
  assert.equal(source.changes.length, 0);
});

for (const horizontal of [false, true]) {
  for (const explicit of [false, true]) {
    test(`swap-only thresholds (horizontal: ${horizontal}, explicit: ${explicit})`, (t) => {
      configureDnD({ bottomTopThreshold: 0.2, leftRightThreshold: 0.2 });
      const options = explicit ? { bottomTopThreshold: 0.2, leftRightThreshold: 0.2 } : {};
      const l = list(t, data(), options, { horizontal, allowReorder: false, allowSwap: true });
      const source = l.rows.get("A").element;
      const target = l.rows.get("C").element;
      send(source, "dragstart");
      flushFrames();
      for (const position of [1, 50, 99]) {
        const coords = horizontal ? { clientX: position, clientY: 50 }
          : { clientX: 50, clientY: position };
        send(target, "dragover", coords);
        assert.equal(target.hasAttribute("data-dnd-accepts"), !explicit || position === 50);
        send(target, "drop", coords);
      }
      send(source, "dragend");
      assert.equal(l.changes.length, explicit ? 1 : 3);
      assert.deepEqual(l.changes[0][1].ids, ["C", "B", "A", "D"]);
    });
  }
}

test("swaps are refused by default even with a center zone", (t) => {
  const l = list(t, data(), { bottomTopThreshold: 0.2 });
  drop(l.rows.get("A").element, l.rows.get("C").element, { clientY: 50 });
  assert.equal(l.changes.length, 0);
});
