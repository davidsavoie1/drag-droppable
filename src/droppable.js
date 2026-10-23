import { getConfig } from "./configure.js";
import { DND_STORE, DROPPABLE } from "./constants.js";
import {
  registerDragCleanup,
  registerDragListeners,
  unregisterDragListeners,
} from "./dndSubs.js";
import {
  cloneWhenObject,
  getClientRect,
  isElement,
  isFunc,
  noop,
} from "./functions.js";

const EVENT_TYPES_TO_BLOCK = ["dragenter", "dragleave", "dragover", "drop"];

/**
 * Create a drop target controller compatible with the Svelte store contract.
 * Bind it with `bind(element)` or `use:dndDrop={store}`.
 * Subscribers receive the active drag context, acceptance and hover position.
 * See the README for options and callback signatures.
 */
export default function droppable(options) {
  let el;
  let destroyed = false;
  let subscribers = new Set();
  let state = {};

  let _options = {};

  let dragListeners = {}; /* Subscriptions to drag event by type */
  let activeDragCleanup; /* Cleanup shared with the source for the current session */

  function assertNotDestroyed() {
    if (destroyed)
      throw new Error("Cannot reuse a destroyed droppable controller.");
  }

  function setElement(element) {
    assertNotDestroyed();
    if (isElement(el) && el !== element) {
      throw new Error("Cannot bind more than once to an element.");
    }

    el = element;
  }

  function setOptions(newOptions) {
    assertNotDestroyed();
    if (!newOptions) {
      _options = { disabled: true };
    } else {
      const { el: newEl, ...rest } = newOptions;

      if (!isElement(el) && isElement(newEl)) {
        setElement(newOptions.el);
      }

      _options = { ...rest };
    }

    updateRegistration();
  }

  function updateRegistration() {
    if (!isElement(el) || _options.disabled) {
      unregister();
    } else {
      register();
    }
  }

  function getTarget() {
    const { target } = _options || {};

    if (!target) return el;

    /* `target` can be a query selector string */
    if (typeof target === "string") {
      const searchedEl = el.querySelector(target);
      return searchedEl || el;
    }

    /* `target` can be an element itself */
    return target || el;
  }

  let unsetDataAttributes;

  function setDataAttributes() {
    const { attributesPrefix = getConfig().attributesPrefix, namespace } =
      _options;
    const droppableEl = el;

    if (!attributesPrefix || !droppableEl) return noop;

    droppableEl.toggleAttribute(`data-${attributesPrefix}-droppable`, true);

    if (namespace) {
      droppableEl.setAttribute(
        `data-${attributesPrefix}-droppable-namespace`,
        namespace,
      );
    }

    return () => {
      droppableEl.toggleAttribute(`data-${attributesPrefix}-droppable`, false);
      droppableEl.removeAttribute(
        `data-${attributesPrefix}-droppable-namespace`,
      );
    };
  }

  let registeredNamespace;

  function register() {
    unregister();

    const { disabled, namespace, type, types = type ? [type] : [] } = _options;
    if (disabled || types.length < 1) return;

    dragListeners = Object.fromEntries(
      types.map((type) => [type, createHandler(type)]),
    );

    unsetDataAttributes = setDataAttributes();

    registeredNamespace = namespace;
    registerDragListeners(dragListeners, namespace);
  }

  function unregister() {
    unsetDataAttributes?.();
    unregisterDragListeners(dragListeners, registeredNamespace);
    dragListeners = {};
    activeDragCleanup?.();
  }

  function subscribe(callback) {
    if (!isFunc(callback)) {
      throw new TypeError("'subscribe' callback must be a function");
    }

    callback(state);
    if (destroyed) return () => {};
    subscribers.add(callback);

    /* Unsubscribe */
    return () => subscribers.delete(callback);
  }

  function publish(newState = state) {
    state = newState;
    toggleAttributes();
    subscribers.forEach((sub) => sub(state));
  }

  function toggleAttributes({ forceRemove = false } = {}) {
    if (!el) return;

    const {
      attributesPrefix = getConfig().attributesPrefix,
      bottom,
      concerned,
      canDrop,
      dragging,
      left,
      right,
      top,
      type,
      unconcerned,
    } = state;

    if (!attributesPrefix) return;

    const shouldSet = !forceRemove && !!dragging;

    /* Position attributes are present only during an accepted hover. */
    Object.entries({
      bottom: canDrop && bottom,
      can: canDrop,
      concerned,
      left: canDrop && left,
      right: canDrop && right,
      top: canDrop && top,
      unconcerned,
    }).forEach(([k, v]) => {
      el.toggleAttribute(`data-${attributesPrefix}-${k}`, !!(shouldSet && v));
    });

    shouldSet
      ? el.setAttribute(`data-${attributesPrefix}-dragged-type`, type)
      : el.removeAttribute(`data-${attributesPrefix}-dragged-type`);
  }

  function unsubscribeAll() {
    subscribers.clear();
  }

  function createHandler(type) {
    const {
      attributesPrefix = getConfig().attributesPrefix,
      data: dropData,
      disabled,
      namespace,
      unless,
      when,
      onDrop,
    } = _options;

    if (disabled) return;

    const _onDrop = dipatchByType(onDrop, type);
    const _unless = dipatchByType(unless, type);
    const _when = dipatchByType(when, type);

    return function handler({ data: draggedData, onDrop: draggedOnDrop }) {
      const baseArgs = {
        dragged: draggedData,
        drop: dropData,
        namespace,
        type,
      };

      /* Evaluate acceptance once for this drag, before installing DOM handlers. */
      const concerned = !!(
        (!_when || _when(draggedData, baseArgs)) &&
        (!_unless || !_unless(draggedData, baseArgs))
      );

      const target = getTarget();

      let handlersSet = false; /* Are handlers set on the element? */
      let dragoverEl = undefined; /* Element being dragged over */
      let lastPositionning =
        {}; /* Last positionning of dragged element over drop */

      let cleaned = false;
      let cleanupHandlers;

      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        if (activeDragCleanup === cleanup) activeDragCleanup = undefined;
        cleanupHandlers();
        resetState();
      }

      /* Install and retain cleanup before notifying subscribers: a subscriber
       * may immediately disable or detach this target. */
      activeDragCleanup?.();
      activeDragCleanup = cleanup;
      if (concerned) {
        setHandlers();
        cleanupHandlers = unsetHandlers;
      } else {
        cleanupHandlers = handleUnconcerned();
      }

      registerDragCleanup(cleanup);

      publish({
        ...baseArgs,
        attributesPrefix,
        canDrop: false,
        concerned,
        dragging: true,
        unconcerned: concerned === false,
      });

      function handleUnconcerned() {
        const prevCursor = target?.style?.cursor || "";

        target.style.cursor = "not-allowed";

        function blockEvent(e) {
          e.dataTransfer.dropEffect = "none";
          e.preventDefault();
          e.stopPropagation();
        }

        EVENT_TYPES_TO_BLOCK.forEach((eventType) =>
          target.addEventListener(eventType, blockEvent),
        );

        return () => {
          EVENT_TYPES_TO_BLOCK.forEach((eventType) =>
            target.removeEventListener(eventType, blockEvent),
          );
          target.style.cursor = prevCursor;
        };
      }

      function resetState() {
        toggleAttributes({ forceRemove: true });
        publish({});
      }

      function setDragoverEl(overEl, positionning) {
        /* Prevent processing if nothing significant changed */
        if (!positionningChanged(positionning) && dragoverEl === overEl) return;

        lastPositionning = positionning;
        dragoverEl = overEl;

        publish({ ...state, canDrop: true, ...positionning });
      }

      function unsetDragoverEl() {
        dragoverEl = null;
        lastPositionning = {};
        const {
          x,
          y,
          dx,
          dy,
          left,
          right,
          top,
          bottom,
          ...stateWithoutPositionning
        } = state;

        publish({
          ...stateWithoutPositionning,
          canDrop: null,
        });
      }

      function computePositionning(e) {
        const rect = getClientRect(target);
        if (!rect) return {};

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dx = rect.width > 0 ? x / rect.width : 0;
        const dy = rect.height > 0 ? y / rect.height : 0;

        return {
          x,
          y,
          dx,
          dy,
          left: dx < 0.5,
          right: dx >= 0.5,
          top: dy < 0.5,
          bottom: dy >= 0.5,
        };
      }

      function positionningChanged(positionning) {
        return ["x", "y", "dx", "dy"].some(
          (k) => positionning?.[k] !== lastPositionning?.[k],
        );
      }

      function dragover(e) {
        e.stopPropagation();
        e.preventDefault();
        setDragoverEl(e.target, computePositionning(e));
      }

      function dragleave(e) {
        if (e.target !== dragoverEl) return;
        unsetDragoverEl();
      }

      function drop(e) {
        e.stopPropagation();
        if (e.target !== dragoverEl) return;

        const args = {
          ...baseArgs,
          ...computePositionning(e),
        };

        e.preventDefault();
        _onDrop?.(args);
        draggedOnDrop?.(args);
        unsetDragoverEl();
      }

      function setHandlers() {
        if (handlersSet) return;

        target.addEventListener("dragenter", dragover);
        target.addEventListener("dragover", dragover);
        target.addEventListener("dragleave", dragleave);

        /* Set drop handler only if an effect might occur. */
        if (_onDrop || draggedOnDrop) {
          target.addEventListener("drop", drop);
        }

        handlersSet = true;
      }

      function unsetHandlers() {
        if (!handlersSet) return;

        target.removeEventListener("dragenter", dragover);
        target.removeEventListener("dragover", dragover);
        target.removeEventListener("dragleave", dragleave);
        target.removeEventListener("drop", drop);
        dragoverEl = undefined;
        handlersSet = false;
      }
    };
  }

  setOptions(options);

  return {
    /* Attach the controller to a single DOM element. Rebinding to the same
     * element is allowed, but switching to a different element requires
     * `unbind()` first. */
    bind(element) {
      setElement(element);
      updateRegistration();
    },

    /* Fully tear down the controller. This is terminal for the current
     * store instance. */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      toggleAttributes({ forceRemove: true });
      unregister();
      unsubscribeAll();
      el = undefined;
      publish({});
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

    subscribe,

    /* Detach from the currently bound element without destroying the store.
     * The same store may then be rebound later. */
    unbind() {
      if (destroyed) return;
      toggleAttributes({ forceRemove: true });
      unregister();
      el = undefined;
      publish({});
    },

    [DND_STORE]: true,
    [DROPPABLE]: true,
  };
}

/* Use a shared callback or select the callback for this drag type. */
function dipatchByType(fnOrFnsMap, type) {
  if (typeof fnOrFnsMap === "function") return fnOrFnsMap;
  const fn = fnOrFnsMap?.[type];
  return typeof fn === "function" ? fn : undefined;
}
