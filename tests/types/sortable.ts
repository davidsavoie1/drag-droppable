import {
  createSortable,
  type SortableAction,
  type SortableBinding,
  type SortableItemOptions,
  type SortableOptions,
} from "../../src/index.js";
import type { Action } from "svelte/action";

type Baby = { id: string; hunger: number };
declare const element: HTMLDivElement;
const baby: Baby = { id: "mia", hunger: 6 };

const identity = createSortable<string>({
  horizontal: true,
  allowExternal: true,
  noAfter: true,
  noBefore: false,
  noReorder: true,
  noSwap: true,
  onListChange(data, context) {
    const values: string[] = data;
    const dragged: string = context.drag;
    const target: string = context.drop;
    const external: boolean = context.external;
    const sourceIndex: number | undefined = context.dragIndex;
    const top: boolean | undefined = context.top;
    // @ts-expect-error the second argument is context, not the ids array
    const oldIds: string[] = context;
    const keys: string[] = context.ids;
  },
});
const svelteAction: Action<HTMLElement, SortableItemOptions<string, string>> = identity;
const binding: SortableBinding<string, string> = identity(element, { data: "Mia", index: 0 });
binding.update({ data: "Leo", index: 0 });
binding.destroy();
// @ts-expect-error index is required
identity(element, { data: "Mia" });
// @ts-expect-error wrong item data
identity(element, { data: 42, index: 0 });
// @ts-expect-error updates require an options object, not an updater
binding.update((options) => options);
// @ts-expect-error falsy resets are not supported by sortable
binding.update(null);

const byFunction = createSortable({
  dataToId: (data: Baby) => data.id,
  onListChange(data, context) {
    const values: Baby[] = data;
    const keys: string[] = context.ids;
  },
});
const byKey = createSortable({
  dataToId: "id",
  onListChange(data: Baby[], context) {
    const keys: string[] = context.ids;
  },
});
const action: SortableAction<Baby, string> = byKey;
byFunction(element, {
  data: baby,
  index: 0,
  unless: { baby: ({ drag, drop, left }) => drag.hunger > drop.hunger && !!left },
  onDrop({ drag, drop }) {
    const source: Baby = drag;
    const target: Baby = drop;
  },
  onDrag(data) {
    const original: Baby = data.data;
    const id: string = data.id;
  },
  when: ({ drop }) => drop.data.hunger > 0,
  onChange(state) {
    const local: Baby | undefined = state.drop?.data;
  },
});
// @ts-expect-error sortable only supports a shared onDrop function
byKey(element, { data: baby, index: 0, onDrop: { baby: () => {} } });
const options: SortableOptions<Baby, string> = { dataToId: "id" };
createSortable(options);
createSortable({ dataToId: "id" });
createSortable();

const oldCallback: SortableOptions<string, string> = {
  // @ts-expect-error list changes use onListChange, not the item onChange callback
  onChange: () => {},
};
const invalidRestriction: SortableOptions = {
  // @ts-expect-error position restrictions are booleans
  noSwap: "yes",
};

const invalidExternal: SortableOptions = {
  // @ts-expect-error external acceptance is a boolean
  allowExternal: "yes",
};

const invalidReorder: SortableOptions = {
  // @ts-expect-error reorder restriction is a boolean
  noReorder: "yes",
};
