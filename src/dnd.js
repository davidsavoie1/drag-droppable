import draggable from "./draggable.js";
import droppable from "./droppable.js";
import { isDnDStore } from "./functions.js";

/* Shared adapter: own and destroy stores created from options; only unbind
 * supplied stores. A bound store instance cannot be replaced through update. */
export function dnd(el, args) {
  if (isDnDStore(args)) {
    const { bind, unbind } = args;
    bind(el);

    return {
      destroy: unbind,
      update(newArgs) {
        /* Configuration changes belong to the supplied store. */
        if (newArgs === args) return;

        throw new Error("Cannot update DnD store in 'dnd'.");
      },
    };
  }

  const {
    draggable: isDraggable,
    droppable: isDroppable,
    ...options
  } = args || {};

  const dndStore = isDraggable
    ? draggable(options)
    : isDroppable
      ? droppable(options)
      : undefined;

  if (!dndStore) {
    throw new Error(
      "'dnd' should specify 'draggable: true' or 'droppable: true' when no DnD store is provided.",
    );
  }

  const { bind, destroy, update } = dndStore;
  bind(el);

  return {
    destroy,
    update,
  };
}

/**
 * Bind a drag source using options or an existing controller.
 * Also usable as a Svelte action: `use:dndDrag={optionsOrStore}`.
 * Returns `update` and `destroy`; supplied stores are only unbound on destroy.
 */
export function dndDrag(el, args) {
  return dnd(el, isDnDStore(args) ? args : { ...args, draggable: true });
}

/**
 * Bind a drop target using options or an existing controller.
 * Also usable as a Svelte action: `use:dndDrop={optionsOrStore}`.
 * Returns `update` and `destroy`; supplied stores are only unbound on destroy.
 */
export function dndDrop(el, args) {
  return dnd(el, isDnDStore(args) ? args : { ...args, droppable: true });
}
