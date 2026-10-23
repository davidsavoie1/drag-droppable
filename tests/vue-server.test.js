import assert from "node:assert/strict";
import { test } from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { useDraggable, useDroppable } from "../src/vue.js";

test("Vue composables render idle state without DOM globals", async () => {
  assert.equal(typeof document, "undefined");
  let evaluated = false;
  const app = createSSRApp({
    setup() {
      const source = useDraggable(() => {
        evaluated = true;
        return { type: "food" };
      });
      const target = useDroppable({ type: "food" });
      return () =>
        h(
          "section",
          null,
          h("div", { ref: source.ref }, String(source.state.value.dragging)),
          h("div", { ref: target.ref }, String(target.state.value.canDrop)),
        );
    },
  });
  assert.equal(
    await renderToString(app),
    "<section><div>false</div><div>undefined</div></section>",
  );
  assert.equal(evaluated, false);
});
