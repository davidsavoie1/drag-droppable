import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { useDraggable, useDroppable, useDnD, useCreateSortable, useSortable } from "drag-droppable/react";

test("hooks render on the server without DOM globals", () => {
  assert.equal(typeof document, "undefined");
  function App() {
    const drag = useDraggable({ type: "food", data: { quality: 2 } });
    const drop = useDroppable({ type: "food", data: { hunger: 6 } });
    return h(
      "section",
      null,
      h("div", { ref: drag.ref }, String(drag.state.dragging)),
      h("div", { ref: drop.ref }, String(drop.state.accepts)),
    );
  }
  assert.equal(
    renderToString(h(App)),
    "<section><div>false</div><div>undefined</div></section>",
  );
});


test("combined and sortable React hooks render idle state on the server", () => {
  function App() {
    const list = useCreateSortable({ onListChange() { assert.fail("SSR callback"); } });
    const item = useSortable(list, { data: "A", index: 0, type: "item" });
    const combined = useDnD({ type: "item" });
    return h("section", null,
      h("div", { ref: item.ref }, String(item.state.dragging)),
      h("div", { ref: combined.ref }, String(combined.state.dragging)));
  }
  assert.equal(renderToString(h(App)), "<section><div>false</div><div>false</div></section>");
});
