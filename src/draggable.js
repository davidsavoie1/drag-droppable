import { getConfig } from "./configure.js";
import { DND_STORE, DRAGGABLE, DRAG_SOURCE } from "./constants.js";
import { publishDrag } from "./dndSubs.js";
import {
  cloneWhenObject,
  getClientRect,
  isElement,
  isFunc,
  isSyntheticEvent,
  noop,
  preventDefault,
  preventNativeDefault,
} from "./functions.js";
import {
  isTouchInProgress,
  registerTouchDnDTarget,
  unregisterTouchDnDTarget,
} from "./dragDropTouch.js";

/**
 * Create a drag source controller compatible with the Svelte store contract.
 * Bind it with `bind(element)` or `use:dndDrag={store}`.
 * Subscribers receive `dragging` and the initiating `pointerType`.
 * See the README for options and callback signatures.
 */
export default function draggable(options = {}) {
  const sourceIdentity = {};

  /* draggable options (can be updated dynamically) */
  let _options = {};
  let activeHandle = undefined;
  let el;
  let onChange;
  let destroyed = false;
  /* Cleanup function to execute when drag ends */
  let dragEndCleanup = undefined;
  /* Source values and end callback captured at drag start */
  let dragSession;
  /* Are handlers set on the element? */
  let handlersSet = false;
  /* Store the original pointerdown target */
  let lastPointerDownTarget = undefined;
  /* Keep track of last pointer type on pointerdown */
  let lastPointerType = undefined;
  /* Animation frame reference */
  let pendingDragFrame = undefined;
  let subscribers = new Set();
  let state = {
    dragging: false /* Is the element currently being dragged? */,
  };
  let unsetDataAttributes;

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
      unsetHandlers();
      unsubscribeAll();
      el = undefined;
      publish({ dragging: false });
      onChange = undefined;
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

    subscribe,

    /* Detach from the currently bound element without destroying the store.
     * The same store may then be rebound later. */
    unbind() {
      if (destroyed) return;
      unsetHandlers();
      el = undefined;
      publish({ dragging: false });
    },

    [DRAG_SOURCE]: sourceIdentity,
    [DND_STORE]: true,
    [DRAGGABLE]: true,
  };

  function assertNotDestroyed() {
    if (destroyed)
      throw new Error("Cannot reuse a destroyed draggable controller.");
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
    const previousOnChange = onChange;
    if (!newOptions) {
      _options = { disabled: true };
    } else {
      const { el: newEl, ...rest } = newOptions;

      if (!isElement(el) && isElement(newEl)) {
        setElement(newEl);
      }

      _options = rest;
    }

    const currentOptions = _options;
    onChange = isFunc(_options.onChange) ? _options.onChange : undefined;
    if (onChange !== previousOnChange) onChange?.(state);

    /* A notification may replace options or destroy the controller. */
    if (destroyed || _options !== currentOptions) return;
    updateRegistration();
  }

  function publish(newState = state) {
    const keys = new Set([...Object.keys(state), ...Object.keys(newState)]);
    if ([...keys].every((key) => Object.is(state[key], newState[key]))) return;

    state = newState;
    toggleAttributes();
    onChange?.(state);
    subscribers.forEach((sub) => sub(state));
  }

  function subscribe(callback) {
    if (!isFunc(callback)) {
      throw new TypeError("'subscribe' callback must be a function");
    }

    callback(state);
    if (destroyed) return () => {};
    subscribers.add(callback);

    return () => subscribers.delete(callback);
  }

  function unsubscribeAll() {
    subscribers.clear();
  }

  function setState(fnOrPartial) {
    publish(
      typeof fnOrPartial === "function"
        ? fnOrPartial(state)
        : { ...state, ...fnOrPartial },
    );
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
        unsetDataAttributes?.();
        unsetDataAttributes = setDataAttributes();
        updateTouchRegistration(nextHandle);
      }
    }
  }

  function dragstart(e) {
    /* A nested draggable owns its event, even when it cancels the drag. */
    if (e.target !== activeHandle) return;

    const {
      attributesPrefix = getConfig().attributesPrefix,
      data,
      disabled,
      dragEl = el,
      effectAllowed,
      except,
      namespace,
      type,
      onDrag,
      onDragEnd,
      onDrop,
    } = _options;

    /* Use the original pointerdown target for exception check */
    const shouldIgnore = isException(except, lastPointerDownTarget || e.target);

    if (disabled || shouldIgnore) {
      preventDefault(e);
      dragend();
      return;
    }

    /* Touch drags belong to the synthetic engine. Block native long-press
     * drags even when touch DnD is disabled, as well as native duplicates
     * during a synthetic session. Mouse-initiated drags remain native. */
    if (
      !isSyntheticEvent(e) &&
      (lastPointerType === "touch" || isTouchInProgress())
    ) {
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
      const session = { data, namespace, type, onDragEnd };
      dragSession = session;

      /* Defer target notification until the next frame so reactive updates can run. */
      pendingDragFrame = requestAnimationFrame(() => {
        pendingDragFrame = undefined;
        const cleanup = publishDrag({
          namespace,
          type,
          data,
          onDrop,
          source: sourceIdentity,
        });

        /* A target subscriber may end or replace this session synchronously
         * during publication, before its cleanup becomes available. */
        if (dragSession === session) {
          dragEndCleanup = cleanup;
        } else {
          cleanup?.();
        }
      });

      setState({
        attributesPrefix,
        dragging: true,
        pointerType: lastPointerType,
      });

      /* A subscriber may synchronously disable or detach this source. */
      if (!state.dragging) {
        preventDefault(e);
        return;
      }

      onDrag?.(data, type, namespace);

      /* onDrag may cancel too. Cancel the DOM drag as well as the controller. */
      if (!state.dragging) preventDefault(e);
    }
  }

  function dragend(e) {
    /* Internal cleanup calls have no event; bubbled child events are ignored. */
    if (e && e.target !== activeHandle) return;

    cancelAnimationFrame(pendingDragFrame);
    pendingDragFrame = undefined;

    const { data, namespace, type, onDragEnd } = dragSession || {};
    dragSession = undefined;

    const cleanup = dragEndCleanup;
    dragEndCleanup = undefined;

    try {
      if (state.dragging) {
        setState({
          dragging: false,
          pointerType: undefined,
        });

        onDragEnd?.(data, type, namespace);
      }
    } finally {
      /* Application callbacks must not prevent target cleanup. */
      cleanup?.();
    }
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

    const { touch } = _options || {};
    registerTouchDnDTarget(handle, touch);
  }

  function setDataAttributes() {
    const {
      attributesPrefix = getConfig().attributesPrefix,
      namespace,
      type,
    } = _options;
    const draggableEl = el;

    if (!attributesPrefix || !draggableEl) return noop;

    draggableEl.toggleAttribute(`data-${attributesPrefix}-draggable`, true);

    if (namespace) {
      draggableEl.setAttribute(
        `data-${attributesPrefix}-draggable-namespace`,
        namespace,
      );
    }

    if (type) {
      draggableEl.setAttribute(`data-${attributesPrefix}-draggable-type`, type);
    }
    return () => {
      draggableEl.toggleAttribute(`data-${attributesPrefix}-draggable`, false);
      draggableEl.removeAttribute(
        `data-${attributesPrefix}-draggable-namespace`,
      );
      draggableEl.removeAttribute(`data-${attributesPrefix}-draggable-type`);
    };
  }

  function setHandlers() {
    if (handlersSet) return;

    unsetDataAttributes = setDataAttributes();

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

    unsetDataAttributes?.();

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
