import { createClasses } from "./classes.js";
import { getConfig } from "./configure.js";
import {
  DND_STORE,
  DROPPABLE,
  DRAG_SOURCE,
  DROP_POSITION,
} from "./constants.js";
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
} from "./functions.js";

/**
 * Create a drop target controller compatible with the Svelte store contract.
 * Bind it with `bind(element)` or `use:dndDrop={store}`.
 * Subscribers receive the active drag context, acceptance and hover position.
 * See the README for options and callback signatures.
 */
export default function droppable(options) {
  let _options = {};
  let activeDrag; /* Participation kept independently of registry subscriptions. */
  let destroyed = false;
  let dragListeners = {}; /* Subscriptions to drag event by type */
  let el;
  let onChange;
  let registeredNamespace;
  let state = {};
  let subscribers = new Set();
  let unsetDataAttributes;
  const staticClasses = createClasses();
  const activeClasses = createClasses();

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
      activeDrag?.cleanup();
      onChange = undefined;
      unsubscribeAll();
      el = undefined;
      publish({});
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
      toggleAttributes({ forceRemove: true });
      unregister();
      activeDrag?.cleanup();
      el = undefined;
      publish({});
    },

    [DND_STORE]: true,
    [DROPPABLE]: true,
  };

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
    const previousOnChange = onChange;
    if (!newOptions) {
      _options = { disabled: true };
    } else {
      const { el: newEl, ...rest } = newOptions;

      if (!isElement(el) && isElement(newEl)) {
        setElement(newEl);
      }

      _options = { ...rest };
    }

    const currentOptions = _options;
    onChange = isFunc(_options.onChange) ? _options.onChange : undefined;
    if (!previousOnChange) onChange?.(state);

    /* The initial notification may replace options or destroy the controller. */
    if (destroyed || _options !== currentOptions) return;

    updateRegistration();
    toggleAttributes();
  }

  function updateRegistration() {
    if (!isElement(el) || _options.disabled) {
      unregister();
      activeDrag?.cleanup();
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

  function setDataAttributes() {
    const { attributesPrefix = getConfig().attributesPrefix, namespace } =
      _options;
    const droppableEl = el;

    staticClasses.update(droppableEl, { droppable: true }, _options);
    if (!attributesPrefix || !droppableEl) return () => staticClasses.clear();

    droppableEl.toggleAttribute(`data-${attributesPrefix}-droppable`, true);

    if (namespace) {
      droppableEl.setAttribute(
        `data-${attributesPrefix}-droppable-namespace`,
        namespace,
      );
    }

    return () => {
      staticClasses.clear();
      droppableEl.toggleAttribute(`data-${attributesPrefix}-droppable`, false);
      droppableEl.removeAttribute(
        `data-${attributesPrefix}-droppable-namespace`,
      );
    };
  }

  function register() {
    unregister();

    const { disabled, namespace, type, types = type ? [type] : [] } = _options;
    if (disabled || types.length < 1) {
      activeDrag?.cleanup();
      return;
    }

    if (
      activeDrag &&
      (!types.includes(activeDrag.type) ||
        (namespace ?? "") !== (activeDrag.session.namespace ?? ""))
    ) {
      activeDrag.cleanup();
    }

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
    /* Avoid notifying subscribers again when an options update changes no state. */
    const keys = new Set([...Object.keys(state), ...Object.keys(newState)]);
    if ([...keys].every((key) => Object.is(state[key], newState[key]))) {
      toggleAttributes();
      return;
    }

    state = newState;
    toggleAttributes();
    onChange?.(state);
    subscribers.forEach((sub) => sub(state));
  }

  function toggleAttributes({ forceRemove = false } = {}) {
    if (!el) return;

    const {
      accepts,
      after,
      attributesPrefix = getConfig().attributesPrefix,
      before,
      bottom,
      center,
      concerned,
      dragging,
      left,
      middle,
      right,
      swap,
      top,
      type,
      unconcerned,
    } = state;

    const shouldSet = !forceRemove && !!dragging;

    /* Position attributes are present only during an accepted hover. */
    const flags = {
      accepts,
      after: accepts && after,
      before: accepts && before,
      bottom: accepts && bottom,
      center: accepts && center,
      concerned,
      left: accepts && left,
      middle: accepts && middle,
      right: accepts && right,
      swap: accepts && swap,
      top: accepts && top,
      unconcerned,
    };
    activeClasses.update(el, Object.fromEntries(
      Object.entries(flags).map(([key, value]) => [key, !!(shouldSet && value)]),
    ), _options);
    if (!attributesPrefix) return;
    Object.entries(flags).forEach(([k, v]) => {
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
    return function handler(session) {
      /* A publication snapshot may still contain an obsolete subscription. */
      if (dragListeners[type] !== handler) return;

      if (activeDrag?.session === session) {
        activeDrag.refresh();
        return;
      }

      activeDrag?.cleanup();
      createActiveDrag(type, session);
    };
  }

  function createActiveDrag(type, session) {
    const { data: draggedData, onDrop: draggedOnDrop } = session;
    let baseArgs;
    let target;
    let concerned;
    let handlersSet = false;
    let dragoverEl;
    let cleanupHandlers;
    let cleaned = false;
    let restoreCursor = "";

    const participation = { type, session, refresh, cleanup };
    activeDrag = participation;
    registerDragCleanup(cleanup);
    refresh();

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (activeDrag === participation) activeDrag = undefined;
      cleanupHandlers?.();
      resetState();
    }

    function refresh(position) {
      const options = _options;
      const {
        attributesPrefix = getConfig().attributesPrefix,
        data: drop,
        namespace,
        when,
        unless,
      } = options;
      const nextArgs = { drag: draggedData, drop, namespace, type };
      const predicateArgs = { ...nextArgs, ...position };
      const nextWhen = dipatchByType(when, type);
      const nextUnless = dipatchByType(unless, type);
      const nextConcerned = !!(
        (!options[DRAG_SOURCE] || options[DRAG_SOURCE] !== session.source) &&
        (!nextWhen || nextWhen(predicateArgs)) &&
        (!nextUnless || !nextUnless(predicateArgs))
      );

      /* Predicates may synchronously update or detach this controller. */
      if (activeDrag !== participation || _options !== options) return;

      const nextTarget = getTarget();
      const preserveHover = concerned && nextConcerned && target === nextTarget;
      const replaceHandlers = target !== nextTarget;

      if (replaceHandlers) cleanupHandlers?.();
      if (state.attributesPrefix !== attributesPrefix) {
        toggleAttributes({ forceRemove: true });
      }

      baseArgs = nextArgs;
      target = nextTarget;
      concerned = nextConcerned;

      if (replaceHandlers) {
        dragoverEl = undefined;
        setHandlers();
        const prevCursor = target.style.cursor || "";
        cleanupHandlers = () => {
          unsetHandlers();
          target.style.cursor = prevCursor;
        };
        restoreCursor = prevCursor;
      }

      target.style.cursor = concerned ? restoreCursor : "not-allowed";
      if (!preserveHover && !position) {
        dragoverEl = undefined;
      }

      publish({
        ...(preserveHover && !position ? state : { accepts: false }),
        ...(position
          ? { accepts: concerned, ...position }
          : preserveHover
            ? options[DROP_POSITION]?.(state)
            : {}),
        ...baseArgs,
        attributesPrefix,
        concerned,
        dragging: true,
        unconcerned: !concerned,
      });
      return activeDrag === participation && _options === options;
    }

    function resetState() {
      toggleAttributes({ forceRemove: true });
      publish({});
    }

    function unsetDragoverEl() {
      dragoverEl = null;
      const {
        after,
        before,
        bottom,
        center,
        dx,
        dy,
        left,
        middle,
        right,
        swap,
        top,
        x,
        y,
        ...stateWithoutPositionning
      } = state;

      publish({
        ...stateWithoutPositionning,
        accepts: null,
      });
    }

    function computePositionning(e) {
      const rect = getClientRect(target);
      if (!rect) return {};

      /* Resolve thresholds per event so local and global updates affect this drag. */
      const config = getConfig();
      const {
        bottomTopThreshold = config.bottomTopThreshold,
        leftRightThreshold = config.leftRightThreshold,
      } = _options;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = rect.width > 0 ? x / rect.width : 0;
      const dy = rect.height > 0 ? y / rect.height : 0;

      const left = isOnSide(dx, leftRightThreshold);
      const right = isOnSide(dx, leftRightThreshold, true);
      const top = isOnSide(dy, bottomTopThreshold);
      const bottom = isOnSide(dy, bottomTopThreshold, true);
      const inside =
        rect.width > 0 &&
        rect.height > 0 &&
        x >= 0 &&
        x <= rect.width &&
        y >= 0 &&
        y <= rect.height;
      const position = {
        bottom,
        center: inside && !left && !right,
        dx,
        dy,
        left,
        middle: inside && !top && !bottom,
        right,
        top,
        x,
        y,
      };
      return { ...position, ..._options[DROP_POSITION]?.(position) };
    }

    function dragover(e) {
      e.stopPropagation();
      e.preventDefault();
      const eventTarget = target;
      const position = computePositionning(e);
      if (!refresh(position) || target !== eventTarget) return;
      if (!concerned && e.dataTransfer) e.dataTransfer.dropEffect = "none";
      dragoverEl = e.target;
    }

    function dragleave(e) {
      if (e.target !== dragoverEl) return;
      unsetDragoverEl();
    }

    function drop(e) {
      if (e.target !== dragoverEl) return;

      const dropTarget = target;
      const position = computePositionning(e);
      if (!refresh(position) || target !== dropTarget) return;
      if (!concerned) {
        if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
        e.stopPropagation();
        e.preventDefault();
        unsetDragoverEl();
        return;
      }
      const onDrop = dipatchByType(_options.onDrop, type);

      if (onDrop || draggedOnDrop) {
        const args = {
          ...baseArgs,
          ...position,
        };

        e.stopPropagation();
        e.preventDefault();
        onDrop?.(args);
        draggedOnDrop?.(args);
      }

      if (activeDrag === participation && target === dropTarget && concerned) {
        unsetDragoverEl();
      }
    }

    function setHandlers() {
      if (handlersSet) return;

      target.addEventListener("dragenter", dragover);
      target.addEventListener("dragover", dragover);
      target.addEventListener("dragleave", dragleave);
      target.addEventListener("drop", drop);

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
  }
}

/* Use a shared callback or select the callback for this drag type. */
function dipatchByType(fnOrFnsMap, type) {
  if (typeof fnOrFnsMap === "function") return fnOrFnsMap;
  const fn = fnOrFnsMap?.[type];
  return typeof fn === "function" ? fn : undefined;
}

/* Classify an edge zone, capped at half the axis. Right/bottom include the
 * boundary; left/top exclude it, preserving the default midpoint split. */
function isOnSide(position, threshold, reversed) {
  if (!threshold || threshold <= 0) return false;

  const coercedThreshold = Math.min(0.5, threshold);

  return reversed
    ? position >= 1 - coercedThreshold
    : position < coercedThreshold;
}
