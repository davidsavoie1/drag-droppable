import { DND_STORE, DRAGDROPPABLE, DRAG_SOURCE } from "./constants.js";
import draggable from "./draggable.js";
import droppable from "./droppable.js";
import { cloneWhenObject, isFunc } from "./functions.js";

/**
 * Create a combined source and target controller compatible with the Svelte store
 * contract. Bind it with `bind(element)` or `use:dnd={store}`.
 * Flat options share data across both roles; onDrop handles received drops only.
 * Self-drops are rejected by source identity unless allowSelfDrop is true.
 * State combines target fields with source fields, so dragging means this element
 * is being dragged. Snapshots stay current even without external subscribers.
 */
export default function dragDroppable(options) {
  let _options = {};
  let destroyed = false;
  let onChange;
  let dragStore = draggable();
  let dropStore = droppable();
  let state = {};
  let subscribers = new Set();

  const unsubscribe = initSubscription();

  setOptions(options);

  return {
    /* Attach the controller to a single DOM element. Rebinding to the same
     * element is allowed, but switching to a different element requires
     * `unbind()` first. */
    bind(element) {
      dragStore.bind(element);
      dropStore.bind(element);
    },

    /* Fully tear down the controller. This is terminal for the current
     * store instance. */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        dragStore.destroy();
      } finally {
        try {
          dropStore.destroy();
        } finally {
          onChange = undefined;
          unsubscribeAll();
          unsubscribe();
        }
      }
    },

    /** Return the current state by reference. Treat it as read-only.
     * The same reference is returned until the state is replaced. */
    getSnapshot() {
      return state;
    },

    /**
     * Replace all options, directly or through an updater receiving a shallow
     * copy. Return the replacement; omitted options are not preserved.
     * Passing or returning a falsy value resets to `{ disabled: true }`.
     */
    update(optionsOrFn) {
      assertNotDestroyed();

      if (isFunc(optionsOrFn)) {
        const curr = cloneWhenObject(_options || {});
        const newOptions = optionsOrFn(curr);
        return setOptions(newOptions);
      }

      setOptions(optionsOrFn);
    },

    subscribe(callback) {
      if (!isFunc(callback)) {
        throw new TypeError("'subscribe' callback must be a function");
      }

      callback(state);
      if (destroyed) return () => {};
      subscribers.add(callback);

      /* Unsubscribe */
      return () => subscribers.delete(callback);
    },

    /* Detach from the currently bound element without destroying the store.
     * The same store may then be rebound later. */
    unbind() {
      dragStore.unbind();
      dropStore.unbind();
    },

    [DND_STORE]: true,
    [DRAGDROPPABLE]: true,
  };

  function assertNotDestroyed() {
    if (destroyed)
      throw new Error("Cannot reuse a destroyed droppable controller.");
  }

  function setOptions(newOptions) {
    assertNotDestroyed();
    const previousOnChange = onChange;
    _options = newOptions ? { ...newOptions } : { disabled: true };
    const currentOptions = _options;
    onChange = isFunc(_options.onChange) ? _options.onChange : undefined;
    if (onChange !== previousOnChange) onChange?.(state);

    /* A notification may replace options or destroy the controller. */
    if (destroyed || _options !== currentOptions) return;
    const {
      allowSelfDrop = false,
      attributesPrefix,
      bottomTopThreshold,
      data,
      disabled,
      dragEl,
      effectAllowed,
      el,
      except,
      handle,
      leftRightThreshold,
      namespace,
      onDrag,
      onDragEnd,
      onDrop,
      target,
      touch,
      type,
      types,
      unless,
      when,
    } = _options;

    const commonProps = {
      attributesPrefix,
      data,
      disabled,
      el,
      namespace,
      type,
    };

    dragStore.update({
      ...commonProps,
      dragEl,
      effectAllowed,
      except,
      handle,
      onDrag,
      onDragEnd,
      touch,
    });

    if (destroyed || _options !== currentOptions) return;
    dropStore.update({
      ...commonProps,
      [DRAG_SOURCE]: allowSelfDrop ? undefined : dragStore[DRAG_SOURCE],
      bottomTopThreshold,
      leftRightThreshold,
      onDrop /* Only called on received drops. */,
      target,
      types,
      unless,
      when,
    });
  }

  function initSubscription() {
    const unsubDrag = dragStore.subscribe((dragState) => {
      const dropState = dropStore.getSnapshot();
      publish({ ...dropState, ...dragState });
    });

    const unsubDrop = dropStore.subscribe((dropState) => {
      const dragState = dragStore.getSnapshot();
      publish({ ...dropState, ...dragState });
    });

    return function unsubscribe() {
      unsubDrag();
      unsubDrop();
    };
  }

  function publish(newState) {
    const keys = new Set([...Object.keys(state), ...Object.keys(newState)]);
    if ([...keys].every((key) => Object.is(state[key], newState[key]))) return;

    state = newState;
    onChange?.(state);
    subscribers.forEach((sub) => sub(state));
  }

  function unsubscribeAll() {
    subscribers.clear();
  }
}
