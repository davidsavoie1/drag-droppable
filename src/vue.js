import {
  onBeforeUnmount,
  onMounted,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
  watchEffect,
} from "vue";
import draggable from "./draggable.js";
import droppable from "./droppable.js";
import dragDroppable from "./dragDroppable.js";
import createSortable from "./sortable.js";
import sortableController from "./sortableController.js";
import { SORTABLE_CONFIG } from "./constants.js";

/** Attach a drag source. Use an options getter to track reactive configuration. */
export function useDraggable(options = {}, settings = {}) {
  return useController(draggable, options, settings);
}

/** Attach a drop target. Set subscribe:false for CSS-only use. */
export function useDroppable(options = {}, settings = {}) {
  return useController(droppable, options, settings);
}

/** Attach both roles and observe their combined state. */
export function useDnD(options = {}, settings = {}) {
  return useController(dragDroppable, options, settings);
}

/** One stable sortable per list; use a getter for reactive list settings. */
export function useCreateSortable(options = {}) {
  const sortable = createSortable(toValue(options));
  let stopOptions;
  onMounted(() => {
    stopOptions = watchEffect(() => { sortable[SORTABLE_CONFIG](toValue(options)); });
  });
  onBeforeUnmount(() => stopOptions?.());
  return sortable;
}

/** Attach one item to a shared sortable from its parent component. */
export function useSortable(sortable, options, settings = {}) {
  return useController(() => sortableController(sortable), options, settings);
}

function useController(factory, options, settings) {
  const controller = factory();
  const element = shallowRef(null);
  const initial = controller.getSnapshot();
  const state = shallowRef(initial);
  let stopOptions;
  let stopElement;
  let stopSubscription;

  /* Server rendering stays idle. DOM effects and subscriptions start on mount. */
  onMounted(() => {
    stopSubscription = watchEffect((onCleanup) => {
      if (toValue(settings).subscribe === false) {
        state.value = initial;
        return;
      }
      onCleanup(
        controller.subscribe((snapshot) => {
          state.value = snapshot;
        }),
      );
    });

    stopOptions = watchEffect(() => {
      controller.update(toValue(options));
    });

    /* Only a different element should rebind; option changes retain hover. */
    stopElement = watch(
      element,
      (node) => {
        controller.unbind();
        if (node) controller.bind(node);
      },
      { immediate: true, flush: "post" },
    );
  });

  onBeforeUnmount(() => {
    stopOptions?.();
    stopElement?.();
    stopSubscription?.();
    controller.destroy();
  });

  return { ref: element, state: shallowReadonly(state), controller };
}
