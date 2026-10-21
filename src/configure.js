import { cloneWhenObject, isObject } from "./functions.js";

export const DEFAULT_TOUCH_OPTIONS = {
  dragImageOpacity: 0.5,
  moveThreshold: 5,
  pressHold: 300,
  pressHoldMargin: 5,
  vibration: 10,
};

const DEFAULT_CONFIG = {
  // Falsy disables data attributes; local options may override this prefix.
  attributesPrefix: "dnd",
  touch: cloneWhenObject(DEFAULT_TOUCH_OPTIONS),
};

let config = DEFAULT_CONFIG;

export function getConfig() {
  return cloneWhenObject(config);
}

export function getTouchConfig() {
  return cloneWhenObject(config?.touch);
}

/* Update global defaults without changing options omitted from this call.
 *
 * touch:
 * - false: disable touch DnD everywhere, including local opt-ins
 * - null: disable inherited touch DnD; local objects may still opt in
 * - true: restore the default touch options
 * - object: merge with the current touch options (or defaults if disabled)
 *
 * Each gesture captures its options at touchstart. Changes affect later gestures.
 */
export default function configureDnD(options = {}) {
  config = {
    ...config,
    ...options,
    touch: normalizeTouchConfig(options.touch, getTouchConfig()),
  };
}

function normalizeTouchConfig(touch, base) {
  if (touch === null) return null;
  if (touch === undefined) return cloneWhenObject(base);
  if (!touch) return false;

  if (isObject(touch)) {
    if (isObject(base)) return { ...base, ...touch };
    return { ...DEFAULT_TOUCH_OPTIONS, ...touch };
  }

  /* Truthy. */
  return cloneWhenObject(DEFAULT_TOUCH_OPTIONS);
}
