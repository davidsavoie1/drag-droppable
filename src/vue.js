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

/** Attach a drag source. Use an options getter to track reactive configuration. */
export function useDraggable(options = {}, settings = {}) {
  return useDnD(draggable, options, settings);
}

/** Attach a drop target. Set subscribe:false for CSS-only use. */
export function useDroppable(options = {}, settings = {}) {
  return useDnD(droppable, options, settings);
}

function useDnD(factory, options, settings) {
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
