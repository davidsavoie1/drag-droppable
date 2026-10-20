import draggable from "./draggable.js";
import droppable from "./droppable.js";
import { isDnDStore } from "./functions.js";

/* Svelte action adapter for DnD controllers.
 *
 * Supported usages:
 * - use:dnd={existingDnDStore}
 * - use:dnd={{ draggable: true, ...options }}
 * - use:dnd={{ droppable: true, ...options }}
 *
 * When plain options are passed, the action creates and owns the underlying
 * store. When an existing store is passed, the action only binds/unbinds it.
 */
export default function dnd(el, args) {
  if (isDnDStore(args)) {
    const { bind, unbind } = args;
    bind(el);

    return {
      destroy: unbind,
      update(newArgs) {
        /* Nevermind the update if the store stays the same. */
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

  const { bind, destroy, set } = dndStore;
  bind(el);

  return {
    destroy,
    update: set,
  };
}
