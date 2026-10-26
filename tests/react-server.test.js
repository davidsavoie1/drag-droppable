import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { useDraggable, useDroppable } from "../src/react.js";

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
