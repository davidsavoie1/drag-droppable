import { DND_STORE, DROPPABLE } from "./constants.js";
import { registerDragListeners, unregisterDragListeners } from "./dndSubs.js";
import { getClientRect, isElement, isFunc } from "./functions.js";

const EVENT_TYPES_TO_BLOCK = ["dragenter", "dragleave", "dragover", "drop"];

/* Create a droppable DnD controller.
 *
 * The returned object follows the Svelte store contract (`subscribe`) and can
 * be bound to a DOM node through `bind` or `use:dnd={store}`.
 *
 * Main options:
 * - data: payload associated with the drop target
 * - disabled: disables the drop target entirely
 * - onDrop: called when a compatible draggable drops on the target
 * - target: element / selector used as the effective drop zone
 * - type: shortcut for a single drag type
 * - types: drag channels accepted by this drop target
 * - unless: predicate or map of predicates that forbids drops
 * - when: predicate or map of predicates that allows drops
 *
 * Store state:
 * - dragging: whether a compatible drag is currently active
 * - concerned: whether the target accepts the current dragged data
 * - canDrop: false before entering, true while over the target, null after leave
 * - dragged: payload from the draggable source
 * - drop/data: payload of the drop target
 * - type: current drag channel
 * - x/y/dx/dy/left/right/top/bottom: last known pointer position over target
 */
export default function droppable(options) {
  let el;
  let subscribers = new Set();
  let state = {};

  /* Internal options. Can be set externally by store method. */
  let _options = {
    // data, // Drop data
    // disabled, // Is drop disabled entirely?
    // target, // Drop target element
    // type, // Concerned by drag type
    // types, // Concerned by drag types
    // unless, // (draggedData, type) | { ...[type]: (draggedData, type) } Function or functions by type that can prevent drop based on dragged data
    // when, // (draggedData, type) | { ...[type]: (draggedData, type) } Function or functions by type that can allow drop based on dragged data
    // onDrop, // ({ dragged, drop, type, x, y, dx, dy, left, right, top, bottom })
  };

  let dragListeners = {}; // Subscriptions to drag event by type

  function setElement(element) {
    if (isElement(el) && el !== element) {
      throw new Error("Cannot bind more than once to an element.");
    }

    el = element;
  }

  function setOptions(newOptions) {
    if (!newOptions) {
      _options = { disabled: true };
    } else {
      const { el: newEl, ...rest } = newOptions;

      if (!isElement(el) && isElement(newEl)) {
        setElement(newOptions.el);
      }

      _options = rest;
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

  function register() {
    unregister();

    const { disabled, type, types = type ? [type] : [] } = _options;
    if (disabled || types.length < 1) return;

    dragListeners = Object.fromEntries(
      types.map((type) => [type, createHandler(type)]),
    );

    registerDragListeners(dragListeners);
  }

  function unregister() {
    unregisterDragListeners(dragListeners);
    dragListeners = {};
  }

  function subscribe(callback) {
    if (!isFunc(callback)) {
      throw new TypeError("'subscribe' callback must be a function");
    }

    callback(state);
    subscribers.add(callback);

    /* Unsubscribe */
    return () => subscribers.delete(callback);
  }

  function publish(newState = state) {
    state = newState;
    subscribers.forEach((sub) => sub(state));
  }

  function unsubscribeAll() {
    subscribers.clear();
  }

  function createHandler(type) {
    const { data: dropData, disabled, unless, when, onDrop } = _options;

    if (disabled) return;

    const _onDrop = dipatchByType(onDrop, type);
    const _unless = dipatchByType(unless, type);
    const _when = dipatchByType(when, type);

    return function handler({ data: draggedData, onDrop: draggedOnDrop }) {
      const concerned = !!(
        (!_when || _when(draggedData, type)) &&
        (!_unless || !_unless(draggedData, type))
      );

      const target = getTarget();

      let handlersSet = false; // Are handlers set on the element?
      let dragoverEl = undefined; // Element being dragged over
      let lastPositionning = {}; // Last positionning of dragged element over drop

      publish({
        canDrop: false,
        concerned,
        data: dropData,
        dragged: draggedData,
        dragging: true,
        drop: dropData,
        type,
        unconcerned: concerned === false,
      });

      /* If not concerned by current data (yet type is the same),
       * publish state, but do not set drop handlers on element.
       * Instead, set dummy handlers that will prevent events from bubbling.
       * Otherwise, underlying elements might get triggered. */
      if (!concerned) return handleUnconcerned();

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
          resetState();
        };
      }

      function resetState() {
        publish({});
      }

      function setDragoverEl(overEl, positionning) {
        /* Prevent processing if nothing significant changed */
        if (!positionningChanged(positionning) && dragoverEl === overEl) return;

        lastPositionning = positionning;
        dragoverEl = overEl;

        publish(
          overEl
            ? { ...state, canDrop: true, ...positionning }
            : { ...state, canDrop: null },
        );
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
        setDragoverEl(null);
      }

      function drop(e) {
        e.stopPropagation();
        if (e.target !== dragoverEl) return;

        const args = {
          dragged: draggedData,
          drop: dropData,
          type,
          ...computePositionning(e),
        };

        e.preventDefault();
        _onDrop?.(args);
        draggedOnDrop?.(args);
        setDragoverEl(null);
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

      /* EXECUTION */
      setHandlers();

      /* CLEANUP */
      function unsetHandlers() {
        if (!handlersSet) return;

        target.removeEventListener("dragenter", dragover);
        target.removeEventListener("dragover", dragover);
        target.removeEventListener("dragleave", dragleave);
        target.removeEventListener("drop", drop);
        setDragoverEl(null);
        handlersSet = false;
      }

      return () => {
        resetState();
        unsetHandlers();
      };
    };
  }

  /* First initialization! */
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
      unregister();
      unsubscribeAll();
      publish({});
    },

    /* Apply a partial options update while preserving previous ones. */
    patch(maybePartialOptions) {
      /* If falsy partial options, `setOptions` will disable */
      if (!maybePartialOptions) return setOptions(null);

      /* Override current options with new partial ones */
      const curr = _options || {};
      return setOptions({ ...curr, ...maybePartialOptions });
    },

    /* Replace the whole option set. Passing a falsy value disables the
     * controller by resetting it to `{ disabled: true }`. */
    set: setOptions,

    subscribe,

    /* Detach from the currently bound element without destroying the store.
     * The same store may then be rebound later. */
    unbind() {
      el = undefined;
      updateRegistration();
      publish({});
    },

    /* Special internal variables to identify which type of store it is */
    [DND_STORE]: true,
    [DROPPABLE]: true,
  };
}

/* Return a function (or undefined) to handle a certain provided type.
 * If first argument is a function, it handles any type.
 * Otherwise, a function could by provided as a prop at the type key. */
function dipatchByType(fnOrFnsMap, type) {
  if (typeof fnOrFnsMap === "function") return fnOrFnsMap;
  const fn = fnOrFnsMap?.[type];
  return typeof fn === "function" ? fn : undefined;
}
