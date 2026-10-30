import { useDnD as reactDnD, useCreateSortable as reactList, useSortable as reactItem } from "../../src/react.js";
import { useDnD as vueDnD, useCreateSortable as vueList, useSortable as vueItem } from "../../src/vue.js";
import { ref } from "vue";

type Item = { id: string; name: string };
const value: Item = { id: "A", name: "Alice" };
const reactCombined = reactDnD<Item>({ data: value, type: "item" });
const reactDragging: boolean = reactCombined.state.dragging;
const reactListAction = reactList({ dataToId: "id", onListChange(next: Item[], context) {
  const ids: string[] = context.ids;
} });
const r = reactItem(reactListAction, { data: value, index: 0, type: "item", onChange(state) {
  const wrapped: Item | undefined = state.drop?.data;
} });
const wrapper: Item | undefined = r.state.drop?.data;
// @ts-expect-error sortable item index is required
reactItem(reactListAction, { data: value });
// @ts-expect-error data must match the shared list
reactItem(reactListAction, { data: "A", index: 0 });
const identity = reactList<string>({ onListChange(next, ctx) {
  const ids: string[] = ctx.ids;
} });
reactItem(identity, { data: "A", index: 0 }, { subscribe: false });

const vueCombined = vueDnD(() => ({ data: value, type: "item" }));
const vueDragging: boolean = vueCombined.state.value.dragging;
const vueAction = vueList(() => ({ dataToId: "id", onListChange(next: Item[], context) {
  const ids: string[] = context.ids;
} }));
const index = ref(0);
const v = vueItem(vueAction, () => ({ data: value, index: index.value }));
const vueWrapper: Item | undefined = v.state.value.drop?.data;
// @ts-expect-error sortable item index is required
vueItem(vueAction, () => ({ data: value }));
const vueIdentity = vueList<string>({ noReorder: true });
vueItem(vueIdentity, { data: "A", index: 0 });
