import assert from "node:assert/strict";
import { test } from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { useDraggable, useDroppable, useDnD, useCreateSortable, useSortable } from "../src/vue.js";

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
          h("div", { ref: target.ref }, String(target.state.value.accepts)),
        );
    },
  });
  assert.equal(
    await renderToString(app),
    "<section><div>false</div><div>undefined</div></section>",
  );
  assert.equal(evaluated, false);
});


test("combined and sortable Vue composables render idle state on the server", async () => {
  const app = createSSRApp({ setup() {
    const list = useCreateSortable({ onListChange() { assert.fail("SSR callback"); } });
    const item = useSortable(list, { data: "A", index: 0, type: "item" });
    const combined = useDnD({ type: "item" });
    return () => h("section", null,
      h("div", { ref: item.ref }, String(item.state.value.dragging)),
      h("div", { ref: combined.ref }, String(combined.state.value.dragging)));
  } });
  assert.equal(await renderToString(app), "<section><div>false</div><div>false</div></section>");
});
