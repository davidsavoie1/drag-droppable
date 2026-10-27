import startAutoScroll from "./autoScroll.js";
import { DEFAULT_TOUCH_OPTIONS, getTouchConfig } from "./configure.js";
import {
  cloneWhenObject,
  dispatchSyntheticEvent as dispatchEvent,
  isNumber,
  isObject,
  noop,
  preventDefault,
  preventNativeDefault,
} from "./functions.js";

const LOG = false;

/* Per-session state only. Global config, the attachment lifecycle and the
 * registry of draggable handles live outside this object so reset() can safely
 * replace it wholesale between touch interactions. */
const DEFAULT_STATE = {
  dataTransfer: null,
  dragImage: null,
  dragImageCustom: null,
  dragImageOffset: { x: 0, y: 0 },
  dragging: false,
  dragSource: null,
  isDragEnabled: false,
  isDropZone: false,
  lastTarget: null,
  lastTouchEvent: null,
  pressHoldTimer: null,
  sessionOptions: null,
  startPoint: null,
  stopAutoScroll: null,
};

const REMOVED_ATTRIBUTES = ["id", "class", "style", "draggable"];

/* Shared touch engine for the current document. Global defaults live in
 * configure.js; this map keeps raw local options for each draggable handle. */
const configByElement = new WeakMap();

/* Session state for the current drag candidate / active drag. `sessionOptions`
 * are resolved once on `touchstart` from global + local config, then kept
 * until the drag completes so updates do not affect an in-flight gesture. */
let state = cloneWhenObject(DEFAULT_STATE);
let restoreUserSelect = null;
const rootDocument = typeof document === "undefined" ? null : document;
let teardown = null;

reset("Init");
attach();

/* Attach listeners once to the current document. */
export function attach() {
  if (teardown) return teardown;
  if (!rootDocument || !("ontouchstart" in rootDocument)) {
    return () => {};
  }

  const touchstart = (e) => handleTouchStart(e);
  const touchmove = (e) => handleTouchMove(e);
  const touchend = (e) => handleTouchEnd(e);
  const listenerOptions = getTouchListenerOptions(rootDocument);

  rootDocument.addEventListener("touchstart", touchstart, listenerOptions);
  rootDocument.addEventListener("touchmove", touchmove, listenerOptions);
  rootDocument.addEventListener("touchend", touchend);
  rootDocument.addEventListener("touchcancel", touchend);

  teardown = () => {
    rootDocument.removeEventListener("touchstart", touchstart, listenerOptions);
    rootDocument.removeEventListener("touchmove", touchmove, listenerOptions);
    rootDocument.removeEventListener("touchend", touchend);
    rootDocument.removeEventListener("touchcancel", touchend);
    reset("Teardown");
    teardown = null;
  };

  return teardown;
}

export function isTouchInProgress() {
  return !!state.dragSource;
}

/* Register raw local touch options on the resolved draggable handle. */
export function registerTouchDnDTarget(el, config) {
  if (!el) return;
  configByElement.set(el, config);
}

export function unregisterTouchDnDTarget(el) {
  if (!el) return;
  configByElement.delete(el);

  /* The draggable controller has already ended its drag and removed its
   * handlers. Cancel the touch engine too, without emitting another dragend. */
  if (state.dragSource === el) {
    reset("source unregistered");
  }
}

/* Start a potential touch drag session.
 *
 * Direct mode:
 * - prevent the browser from taking over immediately
 * - allow touchmove to start drag once the movement threshold is reached
 *
 * Press-hold mode:
 * - allow scrolling until the hold delay completes
 * - temporarily suppress native dragstart on the source element
 * - start the synthetic drag from the timer once the hold is satisfied
 */
function handleTouchStart(e) {
  if (!shouldHandle(e)) return;

  state.lastTouchEvent = e;

  /* If no draggable element detected, do nothing. */
  const source = closestDraggable(e.target);
  if (!source) return;

  /* If no drag options defined, do nothing. */
  const sessionOptions = resolveSessionOptions(source);
  if (!sessionOptions) return;

  const { pressHold } = sessionOptions;

  /* Direct mode claims the gesture immediately. Press-hold mode deliberately
   * leaves the touch sequence alone until the hold timer completes so users
   * can still scroll away naturally. */
  if (!pressHold) {
    preventDefault(e);
  }

  /* Some browsers will emit a native trusted `dragstart` during long-press on
   * a draggable element. Block it for this touch session so the synthetic
   * touch drag stays in control. The listener is removed by reset(). */
  source.addEventListener("dragstart", preventNativeDefault);
  disableUserSelect(source);

  /* Set drag state */
  state.dragSource = source;
  state.sessionOptions = sessionOptions;
  state.startPoint = getPoint(e);
  state.isDragEnabled = !pressHold;

  /* In press-hold mode, the session becomes drag-enabled only after the hold
   * timer completes. The timeout handle is part of session state so reset()
   * can cancel it on movement, touchend or teardown. */
  if (pressHold) {
    state.pressHoldTimer = window.setTimeout(() => {
      state.isDragEnabled = true;
      startDrag(state.lastTouchEvent || e);
    }, pressHold);
  }
}

/* Promote the current touch session into an active drag.
 *
 * The synthetic `dragstart` is dispatched first so draggable logic can still
 * cancel the drag (disabled state, exception zones, etc.). Only after that do
 * we create the drag image and enter dragover tracking. */
function startDrag(e) {
  if (!state.isDragEnabled) return;
  state.lastTouchEvent = e;
  const session = state;
  const { dragSource } = session;

  const dragstartEvent = dispatchSyntheticEvent(e, "dragstart", dragSource);
  /* onDrag or a store subscriber may unregister the source synchronously.
   * reset() replaces state; do not resume a session that was cancelled. */
  if (state !== session) return;
  if (dragstartEvent.defaultPrevented) {
    reset("dragstart prevented");
    return;
  }

  createDragImage(e);
  state.dragging = true;
  vibrate();
  handleDragover(e);
  if (state !== session) return;
  state.stopAutoScroll = startAutoScroll(
    rootDocument,
    () => getPoint(session.lastTouchEvent),
    session.sessionOptions,
    () => {
      if (state !== session) return;
      positionDragImage(session.lastTouchEvent);
      handleDragover(session.lastTouchEvent);
    },
  );
}

function handleDragover(e) {
  const session = state;
  const target = getTarget(e);

  if (target !== state.lastTarget) {
    dispatchSyntheticEvent(state.lastTouchEvent, "dragleave", state.lastTarget);
    if (state !== session) return;
    dispatchSyntheticEvent(e, "dragenter", target);
    if (state !== session) return;
    state.lastTarget = target;
  }

  const dragoverEvent = dispatchSyntheticEvent(e, "dragover", target);

  if (state === session) state.isDropZone = !!dragoverEvent?.defaultPrevented;
}

/* touchmove either keeps behaving like a normal touch interaction or
 * promotes the session into an active drag once thresholds are met. During
 * an active drag it dispatches `dragenter`/`dragleave`/`dragover` and moves
 * the drag image. */
function handleTouchMove(e) {
  if (!shouldHandle(e)) return;

  state.lastTouchEvent = e;

  if (!state.dragSource) {
    return;
  }

  const shouldCancel = shouldCancelPressHoldMove(e);
  if (shouldCancel) {
    reset("Should cancel");
    return;
  }

  if (!shouldHandleTouchMove()) {
    return;
  }

  const { dragging, dragSource } = state;

  if (dragSource && !dragging && shouldStartDragging(e)) {
    startDrag(e);
  }

  if (!state.dragging) {
    return;
  }

  preventDefault(e);
  moveDragImage(e);
  handleDragover(e);
}

/* On release, emit drop if a target accepted dragover. Cancellation skips
 * drop. Both paths emit dragend and clear the session. */
function handleTouchEnd(e) {
  if (!shouldHandle(e)) return;

  destroyDragImage();

  if (!String(e.type).includes("cancel") && state.isDropZone) {
    dispatchSyntheticEvent(state.lastTouchEvent, "drop", state.lastTarget);
  }

  dispatchSyntheticEvent(state.lastTouchEvent, "dragend", state.dragSource);
  reset("dragend");
}

function shouldHandle(e) {
  if (!e) return false;

  /* A second finger cancels the session, even if another listener has
   * prevented this event. Leave the browser free to handle multitouch. */
  if (e.touches?.length > 1) {
    if (state.dragSource) {
      try {
        if (state.dragging) {
          dispatchSyntheticEvent(
            state.lastTouchEvent,
            "dragend",
            state.dragSource,
          );
        }
      } finally {
        reset("multitouch");
      }
    }
    return false;
  }

  if (e.defaultPrevented) return false;
  return e.touches && e.touches.length < 2;
}

function shouldHandleTouchMove() {
  const options = getSessionOptions();
  if (!options) return false;

  if (state.isDragEnabled) return true;

  return !options.pressHold;
}

/* When press-hold is enabled, moving too much before the hold delay expires
 * cancels the drag candidate so regular touch scrolling can proceed. */
function shouldCancelPressHoldMove(e) {
  /* Once drag has started, do not cancel it. */
  if (state.isDragEnabled) return false;

  const options = getSessionOptions();

  /* If press-hold is not enabled, cancel is irrelevant (return null). */
  if (!options?.pressHold) return null;

  /* Check distance against margin */
  return getDelta(e) > options.pressHoldMargin;
}

/* Determine whether the current movement is enough to start dragging under
 * the resolved session policy. */
function shouldStartDragging(e) {
  const options = getSessionOptions();
  if (!options) return false;

  const { pressHold, moveThreshold } = options;

  /* In press-hold mode, drag start is initiated after a timeout */
  if (pressHold) return null;

  const delta = getDelta(e);

  return delta > moveThreshold;
}

function getSessionOptions() {
  return state.sessionOptions;
}

/* Global false overrides all local options. Global null requires a local
 * opt-in (true or object), resolved against defaults. Otherwise, undefined
 * inherits, falsy disables, and an object overrides the global touch options. */
function resolveSessionOptions(source) {
  const globalConfig = getTouchConfig();
  const localConfig = configByElement.get(source);

  if (globalConfig === false) return false;
  if (globalConfig === null) {
    if (isObject(localConfig))
      return { ...DEFAULT_TOUCH_OPTIONS, ...localConfig };
    if (localConfig) return cloneWhenObject(DEFAULT_TOUCH_OPTIONS);
    return false;
  }

  if (localConfig === null) return null;
  if (localConfig === undefined) return cloneWhenObject(globalConfig);
  if (!localConfig) return false;

  if (isObject(localConfig)) return { ...globalConfig, ...localConfig };

  return cloneWhenObject(globalConfig);
}

/* Clear the active drag candidate/session while keeping persistent global and
 * per-element configuration intact. This also removes the temporary native
 * `dragstart` blocker installed on touchstart. */
function reset(reason) {
  // eslint-disable-next-line no-console
  if (LOG && reason) console.log(reason);

  clearTimeout(state.pressHoldTimer);
  state.stopAutoScroll?.();
  destroyDragImage();
  restoreUserSelect?.();
  restoreUserSelect = null;

  /* Restore native dragging for later mouse interactions. */
  state.dragSource?.removeEventListener("dragstart", preventNativeDefault);

  state = cloneWhenObject(DEFAULT_STATE);
  state.dataTransfer = createDataTransfer(state);
}

/* Temporarily suppress selection/callout behavior on the active drag source.
 * This helps iOS avoid turning a press-hold into text selection before the
 * synthetic drag takes over. Only inline styles are touched, and reset()
 * restores the previous inline values exactly. */
function disableUserSelect(el) {
  if (!el) return;

  restoreUserSelect?.();

  const prev = {
    userSelect: el.style.userSelect,
    webkitUserSelect: el.style.webkitUserSelect,
    webkitTouchCallout: el.style.webkitTouchCallout,
  };

  el.style.userSelect = "none";
  el.style.webkitUserSelect = "none";
  el.style.webkitTouchCallout = "none";

  restoreUserSelect = () => {
    el.style.userSelect = prev.userSelect;
    el.style.webkitUserSelect = prev.webkitUserSelect;
    el.style.webkitTouchCallout = prev.webkitTouchCallout;
  };
}

function getPoint(e) {
  const touch = e?.touches?.[0] || e;
  return { x: touch?.clientX, y: touch?.clientY };
}

function getDelta(e) {
  if (!state.startPoint) return 0;

  const point = getPoint(e);
  return (
    Math.abs(point.x - state.startPoint.x) +
    Math.abs(point.y - state.startPoint.y)
  );
}

/* Hit-test the element currently under the pointer, skipping pointer-events:
 * none so the floating drag image does not intercept the drag lifecycle. */
function getTarget(e) {
  const { x, y } = getPoint(e);
  let el = rootDocument?.elementFromPoint(x, y);

  while (el && getComputedStyle(el).pointerEvents === "none") {
    el = el.parentElement;
  }

  return el;
}

/* Create a floating drag image from either a custom drag image specified
 * through `dataTransfer.setDragImage` or from the drag source itself. */
function createDragImage(e) {
  destroyDragImage();

  const source = state.dragImageCustom || state.dragSource;
  if (!source) return;

  const clone = source.cloneNode(true);
  copyStylesDeep(source, clone);
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.opacity = String(getSessionOptions()?.dragImageOpacity ?? 0.5);

  if (!state.dragImageCustom) {
    const rect = source.getBoundingClientRect();
    const point = getPoint(e);
    state.dragImageOffset = {
      x: point.x - rect.left,
      y: point.y - rect.top,
    };
  }

  state.dragImage = clone;
  positionDragImage(e);
  rootDocument?.body?.appendChild(clone);
  if (getSessionOptions()?.lift) liftDragImage(clone);
}

/* A startup cue on the floating image only; list elements stay untouched. */
function liftDragImage(image) {
  const reducedMotion = rootDocument?.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reducedMotion) return;

  const shadow = "0 8px 20px rgba(0, 0, 0, 0.25)";
  const originalShadow = image.style.boxShadow || "none";
  image.style.boxShadow = shadow;

  image.style.transformOrigin = `${state.dragImageOffset.x}px ${state.dragImageOffset.y}px`;
  const originalScale = image.style.scale || "none";
  const scale =
    originalScale === "none"
      ? "1.025"
      : originalScale
          .split(/\s+/)
          .map((value) => Number(value) * 1.025)
          .join(" ");
  image.style.scale = scale;
  image.animate?.(
    [
      { scale: originalScale, boxShadow: originalShadow },
      { scale, boxShadow: shadow },
    ],
    { duration: 50, easing: "ease-out" },
  );
}

function destroyDragImage() {
  if (state.dragImage?.parentElement) {
    state.dragImage.parentElement.removeChild(state.dragImage);
  }

  state.dragImage = null;
}

/* Keep the synthetic drag image visually aligned with the pointer. */
function moveDragImage(e) {
  const session = state;
  requestAnimationFrame(() => {
    if (state === session) positionDragImage(e);
  });
}

function positionDragImage(e) {
  if (!state.dragImage) return;
  const point = getPoint(e);
  const style = state.dragImage.style;
  /* A viewport overlay follows the finger without growing the page's scroll area. */
  style.position = "fixed";
  style.pointerEvents = "none";
  style.zIndex = "999999";
  style.left = `${Math.round(point.x - state.dragImageOffset.x)}px`;
  style.top = `${Math.round(point.y - state.dragImageOffset.y)}px`;
}

function vibrate() {
  const { vibration } = getSessionOptions() || {};
  if (!vibration) return;

  /* Avoid calling vibration before the browser has recorded user activation. */
  if (navigator.userActivation?.hasBeenActive === false) return;

  const pattern =
    isNumber(vibration) || Array.isArray(vibration)
      ? vibration
      : DEFAULT_TOUCH_OPTIONS.vibration;

  navigator?.vibrate?.(pattern);
}

/* Remove identity and styling attributes, then inline computed styles on the
 * clone and its descendants. Skip transitions to keep the image stable. */
function copyStylesDeep(source, clone) {
  REMOVED_ATTRIBUTES.forEach((attr) => clone.removeAttribute(attr));

  if (
    source instanceof HTMLCanvasElement &&
    clone instanceof HTMLCanvasElement
  ) {
    clone.width = source.width;
    clone.height = source.height;
    clone.getContext("2d")?.drawImage(source, 0, 0);
  }

  const computed = getComputedStyle(source);
  for (let i = 0; i < computed.length; i += 1) {
    const key = computed[i];
    if (!key.includes("transition")) {
      clone.style[key] = computed[key];
    }
  }

  clone.style.pointerEvents = "none";

  for (let i = 0; i < source.children.length; i += 1) {
    copyStylesDeep(source.children[i], clone.children[i]);
  }
}

/* Dispatch a synthetic drag/drop DOM event for the current touch session.
 * The helper lives in `functions.js`; this wrapper simply injects the current
 * document and the session-scoped `dataTransfer` shim. */
function dispatchSyntheticEvent(sourceEvent, type, target) {
  return dispatchEvent(
    rootDocument,
    sourceEvent,
    type,
    target,
    state.dataTransfer,
  );
}

/* Walk up from the touch target to find the element marked `draggable`. This
 * is the element that owns touch config and receives the synthetic drag events. */
function closestDraggable(node) {
  for (let current = node; current; current = current.parentElement) {
    if (current.hasAttribute("draggable") && current.draggable) {
      return current;
    }
  }

  return null;
}

/* Lightweight `DataTransfer` shim used for the lifetime of one touch drag
 * session. The same object is reused across synthetic `dragstart`, `dragover`,
 * `drop` and `dragend` so handlers can exchange state just like they would with
 * the native HTML5 API. */
function createDataTransfer(state) {
  let dropEffect = "move";
  let effectAllowed = "all";
  let data = {};

  return {
    get dropEffect() {
      return dropEffect;
    },
    set dropEffect(value) {
      dropEffect = value;
    },

    get effectAllowed() {
      return effectAllowed;
    },
    set effectAllowed(value) {
      effectAllowed = value;
    },

    get types() {
      return Object.keys(data);
    },

    clearData(type) {
      if (type != null) {
        delete data[type];
      } else {
        data = {};
      }
    },

    getData(type) {
      return data[type] || "";
    },

    setData(type, value) {
      data[type] = value;
    },

    setDragImage(img, offsetX, offsetY) {
      state.dragImageCustom = img;
      state.dragImageOffset = { x: offsetX, y: offsetY };
    },
  };
}

/* Detect passive listener support so touchmove can call `preventDefault()`
 * when needed to stop scrolling once a touch drag is active. */
function getTouchListenerOptions(rootDocument) {
  let supportsPassive = false;
  const opts = {
    get passive() {
      supportsPassive = true;
      return true;
    },
  };

  rootDocument.addEventListener("test", noop, opts);
  rootDocument.removeEventListener("test", noop, opts);

  return supportsPassive ? { passive: false, capture: false } : false;
}
