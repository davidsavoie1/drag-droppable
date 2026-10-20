import createDragDropTouch from "./dragDropTouch.js";

const touchDnd = createDragDropTouch();

if (typeof document !== "undefined") {
  touchDnd.attach(document);
}

/**
 * Configure the shared touch drag-and-drop engine used by all DnD controllers
 * in the current document.
 *
 * This only affects touch-initiated drag behavior. Mouse/pointer-based HTML5
 * drag-and-drop remains unchanged.
 *
 * Accepted values:
 * - `false`
 *   Hard-disable touch drag-and-drop globally. No draggable can opt back in.
 * - `null`
 *   Disable global touch defaults, but still allow individual draggables to
 *   opt in by providing `touch: { ... }`.
 * - `true` or `undefined`
 *   Enable touch drag-and-drop with the library defaults (see below).
 * - `object`
 *   Enable touch drag-and-drop with custom global defaults. Supported keys:
 *   - `threshold = 5`: pointer movement needed before drag starts
 *   - `pressHold = 300`: hold duration before drag becomes enabled. Falsy means
 *     direct-drag mode with no hold delay.
 *   - `pressHoldMargin = 5`: maximum movement allowed before hold is cancelled
 *   - `dragImageOpacity = 0.5`: opacity applied to auto-generated drag images
 *   - `vibration = 10`: vibration pattern triggered when touch drag starts.
 *     Set to `false`/`null` to disable. `true` uses the default pulse.
 *
 * Per-draggable `touch` options are resolved on top of this global config:
 * - `touch: undefined` or `true` inherits the active global behavior
 * - `touch: false` or `null` disables touch drag for that draggable
 * - `touch: { ... }` overrides the active global behavior for that draggable
 *
 * @param {false|null|true|undefined|{
 *   threshold?: number,
 *   pressHold?: number|boolean|null,
 *   pressHoldMargin?: number,
 *   dragImageOpacity?: number,
 *   vibration?: boolean|number|number[]|null
 * }} [config]
 */
export function configureTouchDnD(config) {
  touchDnd.configure(config);
}

/* Internal bridge used by draggable handles to register per-element touch
 * behavior with the shared document-level touch engine. */
export function registerTouchDnDTarget(el, config) {
  touchDnd.setElementConfig(el, config);
}

export function unregisterTouchDnDTarget(el) {
  touchDnd.deleteElementConfig(el);
}

/* Internal signal used by draggable to ignore duplicate trusted native
 * `dragstart` events while a synthetic touch session owns the drag. */
export function isTouchInProgress() {
  return touchDnd.isTouchInProgress();
}
