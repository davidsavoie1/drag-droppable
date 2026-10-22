import { DND_STORE, SYNTHETIC } from "./constants.js";

const KEYBOARD_PROPS = ["altKey", "ctrlKey", "metaKey", "shiftKey"];
const POINTER_PROPS = [
  "pageX",
  "pageY",
  "clientX",
  "clientY",
  "screenX",
  "screenY",
];

/* Return the first nonzero bounding rect, checking descendants if needed. */
export function getClientRect(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();

  if (rect?.width > 0 || rect?.height > 0) return rect;

  for (const child of el.children) {
    const childRect = getClientRect(child);
    if (childRect) return childRect;
  }

  return null;
}

export function isDnDStore(arg) {
  return arg?.[DND_STORE];
}

export function isElement(el) {
  return el instanceof Element;
}

export const isNumber = (x) => typeof x === "number";

export const isFunc = (fn) => typeof fn === "function";

export function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isSyntheticEvent(e) {
  return e?.[SYNTHETIC];
}

export function cloneWhenObject(x) {
  if (isObject(x)) return { ...x };
  return x;
}

export function noop() {}

export function preventDefault(e) {
  if (e?.cancelable) {
    e.preventDefault();
  }
}

export function preventNativeDefault(e) {
  if (!isSyntheticEvent(e)) {
    preventDefault(e);
  }
}

/* Dispatch a marked synthetic event with pointer/keyboard fields and the
 * session dataTransfer. Return it so callers can inspect defaultPrevented. */
export function dispatchSyntheticEvent(
  rootDocument,
  sourceEvent,
  type,
  target,
  dataTransfer,
) {
  if (!sourceEvent || !target || !rootDocument) return null;

  const event = rootDocument.createEvent("Event");
  const pointer = sourceEvent.touches ? sourceEvent.touches[0] : sourceEvent;
  event.initEvent(type, true, true);
  event.button = 0;
  event.which = 1;
  event.buttons = 1;
  copyProps(event, sourceEvent, KEYBOARD_PROPS);
  copyProps(event, pointer, POINTER_PROPS);
  event[SYNTHETIC] = true;
  event.dataTransfer = dataTransfer;
  target.dispatchEvent(event);
  return event;
}

function copyProps(target, source, props) {
  props.forEach((prop) => {
    target[prop] = source[prop];
  });
}
