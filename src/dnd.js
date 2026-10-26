import dragDroppable from "./dragDroppable.js";
import draggable from "./draggable.js";
import droppable from "./droppable.js";
import { isDnDStore } from "./functions.js";

/* Shared adapter: own and destroy stores created from options; only unbind
 * supplied stores. A bound store instance cannot be replaced through update. */
function bindDnD(el, args) {
  if (isDnDStore(args)) {
    const { bind, unbind } = args;
    bind(el);

    return {
      destroy: unbind,
      update(newArgs) {
        /* Configuration changes belong to the supplied store. */
        if (newArgs === args) return;

        throw new Error("Cannot replace the controller bound to this element.");
      },
    };
  }

  const {
    dragDroppable: isDragDroppable,
    draggable: isDraggable,
    droppable: isDroppable,
    ...options
  } = args || {};

  const dndStore = isDragDroppable
    ? dragDroppable(options)
    : isDraggable
      ? draggable(options)
      : isDroppable
        ? droppable(options)
        : undefined;

  if (!dndStore) {
    throw new Error(
      "'bindDnD' should specify 'draggable: true' or 'droppable: true' when no DnD store is provided.",
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
 * Bind both roles using flat options or an existing combined controller.
 * onDrop belongs only to the target; type is emitted and types overrides acceptance.
 * Also usable as a Svelte action: `use:dnd={optionsOrStore}`.
 * Returns update and destroy; supplied stores are only unbound on destroy.
 */
export function dnd(el, args) {
  return bindDnD(
    el,
    isDnDStore(args) ? args : { ...args, dragDroppable: true },
  );
  // let _options = {};
  // let destroyed = false;
  // const dragStore = draggable();
  // const dropStore = droppable();

  // function update(optionsOrFn) {
  //   if (destroyed) throw new Error("Cannot update a destroyed DnD binding.");

  //   const newOptions = isFunc(optionsOrFn)
  //     ? optionsOrFn({ ..._options })
  //     : optionsOrFn;
  //   const options = newOptions ? { ...newOptions } : { disabled: true };
  //   _options = options;

  //   const { onDrop, ...dragOptions } = options;
  //   dragStore.update(dragOptions);

  //   /* Ending the source drag may update or destroy this binding synchronously. */
  //   if (!destroyed && _options === options) dropStore.update(options);
  // }

  // function destroy() {
  //   if (destroyed) return;
  //   destroyed = true;
  //   try {
  //     dragStore.destroy();
  //   } finally {
  //     dropStore.destroy();
  //   }
  // }

  // try {
  //   update(options);
  //   dragStore.bind(el);
  //   dropStore.bind(el);
  // } catch (error) {
  //   destroy();
  //   throw error;
  // }

  // return { update, destroy };
}

/**
 * Bind a drag source using options or an existing controller.
 * Also usable as a Svelte action: `use:dndDrag={optionsOrStore}`.
 * Returns `update` and `destroy`; supplied stores are only unbound on destroy.
 */
export function dndDrag(el, args) {
  return bindDnD(el, isDnDStore(args) ? args : { ...args, draggable: true });
}

/**
 * Bind a drop target using options or an existing controller.
 * Also usable as a Svelte action: `use:dndDrop={optionsOrStore}`.
 * Returns `update` and `destroy`; supplied stores are only unbound on destroy.
 */
export function dndDrop(el, args) {
  return bindDnD(el, isDnDStore(args) ? args : { ...args, droppable: true });
}
