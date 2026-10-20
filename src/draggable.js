import { getConfig } from "./configure.js";
import { DND_STORE, DRAGGABLE } from "./constants.js";
import { publishDrag } from "./dndSubs.js";
import {
  getClientRect,
  isElement,
  isFunc,
  isSyntheticEvent,
  preventDefault,
  preventNativeDefault,
} from "./functions.js";
import {
  isTouchInProgress,
  registerTouchDnDTarget,
  unregisterTouchDnDTarget,
} from "./touchDnd.js";

/* Create a draggable DnD controller.
 *
 * The returned object follows the Svelte store contract (`subscribe`) and can
 * be bound to a DOM node through `bind` or `use:dnd={store}`.
 *
 * Main options:
 * - data: payload associated with the drag source
 * - disabled: disables dragging entirely
 * - dragEl: element used as drag image (defaults to the bound element)
 * - effectAllowed: HTML5 drag `dataTransfer.effectAllowed`
 * - except: element / selector / function used to prevent drag start
 * - handle: element / selector used to initiate drag (defaults to bound element)
 * - onDrag: called when dragging starts
 * - onDragEnd: called when dragging ends
 * - onDrop: called when a compatible droppable accepts the drag
 * - touch: touch drag policy for this source.
 *   `undefined`/`true` inherit global touch DnD settings, `false`/`null`
 *   disable touch drag for this source, and an object overrides global
 *   touch settings for this source only, including options such as
 *   `pressHold`, `threshold`, or `vibration`.
 * - type: drag channel listened to by droppables
 *
 * Store state:
 * - dragging: whether the source is currently being dragged
 * - pointerType: last initiating pointer type when dragging
 */
export default function draggable(options = {}) {
  let el;
  let subscribers = new Set();
  let activeHandle = undefined;

  /* Internal options. Can be set externally by store method. */
  let _options = {
    /*
    attributesPrefix, // Prefix used with data-[prefix]-* attributes
    data, // Drag data
    except, // What to ignore when initiating a drag. Element, CSS selector or function.
    disabled, // Is drag disabled entirely?
    dragEl, // Element used as drag image. Can be different than `el`, but default to it.
    effectAllowed, // Which drag-and-drop operations are permitted (copy, move, link, copyMove, all, etc.)
    handle, // Element used to initiate drag on which handlers are declared. Can be different than `el`, but default to it.
    onDrag, // (data, type) Callback for when drag starts
    onDrop, // Same as droppable `onDrop`, but declared on the drag element
    touch, // Are touch initiated drags allowed? Includes "touch" and "pen" pointers.
    type, // Drag type that drop tragets will listen to
    */
  };
  let dragEndCleanup = undefined, // Cleanup function to execute when drag ends
    handlersSet = false, // Are handlers set on the element?
    lastPointerType = undefined, // Keep track of last pointer type on pointerdown
    lastPointerDownTarget = undefined; // Store the original pointerdown target

  let state = {
    dragging: false, // Is the element currently being dragged?
  };

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
        setElement(newEl);
      }

      _options = rest;
    }

    updateRegistration();
  }

  function publish(newState = state) {
    state = newState;
    subscribers.forEach((sub) => sub(state));
  }

  function subscribe(callback) {
    if (!isFunc(callback)) {
      throw new TypeError("'subscribe' callback must be a function");
    }

    callback(state);
    subscribers.add(callback);

    return () => subscribers.delete(callback);
  }

  function unsubscribeAll() {
    subscribers.clear();
  }

  function setState(fnOrPartial) {
    state =
      typeof fnOrPartial === "function"
        ? fnOrPartial(state)
        : { ...state, ...fnOrPartial };

    toggleAttributes();
    publish(state);
  }

  function toggleAttributes() {
    if (!el) return;

    const { attributesPrefix = getConfig().attributesPrefix, dragging } = state;

    if (!attributesPrefix) return;

    el.toggleAttribute(`data-${attributesPrefix}-dragging`, !!dragging);
  }

  function updateRegistration() {
    if (!isElement(el) || _options.disabled) {
      unsetHandlers();
    } else {
      const nextHandle = getHandle();

      if (!handlersSet || nextHandle !== activeHandle) {
        unsetHandlers();
        setHandlers();
      } else {
        updateTouchRegistration(nextHandle);
      }
    }
  }

  function dragstart(e) {
    const {
      attributesPrefix = getConfig().attributesPrefix,
      data,
      disabled,
      dragEl = el,
      effectAllowed,
      except,
      type,
      onDrag,
      onDrop,
    } = _options;

    // Use the original pointerdown target for exception check
    const shouldIgnore = isException(except, lastPointerDownTarget || e.target);

    if (disabled || shouldIgnore) {
      preventDefault(e);
      dragend();
      return;
    }

    /* When touch DnD owns the current gesture, some browsers may still emit a
     * trusted native `dragstart` on the same handle. Ignore that duplicate and
     * keep the synthetic touch session in control. */
    if (!isSyntheticEvent(e) && isTouchInProgress()) {
      preventNativeDefault(e);
      return;
    }

    const xfer = e.dataTransfer;

    if (effectAllowed) xfer.effectAllowed = effectAllowed;
    if (dragEl) {
      const { left = 0 } = getClientRect(dragEl) || {};

      xfer.setDragImage(dragEl, e.clientX - left, 0);
    }

    if (!state.dragging) {
      /* Await Svelte reactive updates first to allow repainting before declaring dragged data */
      requestAnimationFrame(() => {
        dragEndCleanup = publishDrag({ type, data, onDrop });
      });

      onDrag?.(data, type);
      setState({
        attributesPrefix,
        dragging: true,
        pointerType: lastPointerType,
      });
    }
  }

  function dragend() {
    const { data, type, onDragEnd } = _options;

    if (state.dragging) {
      setState({
        dragging: false,
        pointerType: undefined,
      });

      onDragEnd?.(data, type);
    }

    dragEndCleanup?.();
  }

  function getHandle() {
    const { handle } = _options || {};

    if (!handle) return el;

    /* `handle` can be a query selector string */
    if (typeof handle === "string") {
      const searchedEl = el.querySelector(handle);
      return searchedEl || el;
    }

    /* `handle` can be an element itself */
    return handle || el;
  }

  function registerPointer(e) {
    lastPointerType = e.pointerType;
    lastPointerDownTarget = e.target;
  }

  /* Register touch drag policy on the actual draggable handle. The shared
   * touch engine resolves these per-handle configs at touchstart time. */
  function updateTouchRegistration(handle = activeHandle) {
    if (!isElement(handle)) return;

    const { touch = true } = _options || {};
    registerTouchDnDTarget(handle, touch);
  }

  function setHandlers() {
    if (handlersSet) return;

    const handle = getHandle();
    activeHandle = handle;

    handle.setAttribute("draggable", "true");
    handle.addEventListener("pointerdown", registerPointer);
    handle.addEventListener("dragstart", dragstart);
    handle.addEventListener("dragend", dragend);
    updateTouchRegistration(handle);
    handlersSet = true;
  }

  function unsetHandlers() {
    if (!handlersSet) return;

    const handle = activeHandle;

    dragend();
    handle.removeAttribute("draggable");
    handle.removeEventListener("pointerdown", registerPointer);
    handle.removeEventListener("dragstart", dragstart);
    handle.removeEventListener("dragend", dragend);
    unregisterTouchDnDTarget(handle);
    activeHandle = undefined;
    handlersSet = false;
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
      unsetHandlers();
      unsubscribeAll();
      publish({ dragging: false });
    },

    /* Apply a partial options update while preserving previous ones. */
    patch(maybePartialOptions) {
      if (!maybePartialOptions) return setOptions(null);

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
      unsetHandlers();
      el = undefined;
      publish({ dragging: false });
    },

    [DND_STORE]: true,
    [DRAGGABLE]: true,
  };
}

/* Return whether the original pointer target should prevent drag initiation. */
function isException(except, target) {
  if (!except || !target) return false;

  if (typeof except === "function") return except(target);

  /* When string, look for closest parent that respects exception. */
  if (typeof except === "string") {
    const closestException = target.closest(except);
    return !!closestException;
  }

  /* If element, check if the drag target is contained in it */
  if (except instanceof Element)
    return target === except || except.contains(target);

  return false;
}
