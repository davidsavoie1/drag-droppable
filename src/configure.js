import { cloneWhenObject, isObject } from "./functions.js";

export const DEFAULT_TOUCH_OPTIONS = {
  dragImageOpacity: 0.5,
  moveThreshold: 5,
  pressHold: 300,
  pressHoldMargin: 5,
  vibration: 10,
};

const DEFAULT_CONFIG = {
  /* Falsy disables data attributes; local options may override this prefix. */
  attributesPrefix: "dnd",
  /* Height fraction of each top/bottom edge zone; nonpositive disables the axis. */
  bottomTopThreshold: 0.5,
  /* Width fraction of each left/right edge zone; nonpositive disables the axis. */
  leftRightThreshold: 0.5,
  /* Touch configurations, handled separately */
  touch: cloneWhenObject(DEFAULT_TOUCH_OPTIONS),
};

let config = DEFAULT_CONFIG;

/** Return a shallow copy of the global configuration. */
export function getConfig() {
  return cloneWhenObject(config);
}

export function getTouchConfig() {
  return cloneWhenObject(config?.touch);
}

/**
 * Configure global defaults. Omitted non-touch options retain their values.
 * Touch options start from defaults on every call:
 * - false: disable touch DnD everywhere, including local opt-ins
 * - null: enable only sources opting in with local true or an options object
 * - true / undefined: restore default touch options
 * - object: merge with default touch options
 * Position thresholds are capped at 0.5 when used, not when stored here.
 * Each gesture captures its touch options at touchstart.
 */
export default function configureDnD(options = {}) {
  config = {
    ...config,
    ...options,
    touch: normalizeTouchConfig(options.touch),
  };
}

function normalizeTouchConfig(touch) {
  if (touch === null) return null;
  if (touch === undefined) return cloneWhenObject(DEFAULT_TOUCH_OPTIONS);
  if (!touch) return false;

  if (isObject(touch)) {
    return { ...DEFAULT_TOUCH_OPTIONS, ...touch };
  }

  return cloneWhenObject(DEFAULT_TOUCH_OPTIONS);
}
