import { getConfig } from "./configure.js";

/* Share ownership across roles/controllers attached to the same element. */
const elements = new WeakMap();

export const classOptions = [
  "accepts",
  "after",
  "before",
  "bottom",
  "center",
  "concerned",
  "draggable",
  "dragging",
  "droppable",
  "left",
  "middle",
  "right",
  "swap",
  "top",
  "unconcerned",
].map((state) => `class${state[0].toUpperCase()}${state.slice(1)}`);

export function createClasses() {
  let element;
  let current = new Set();

  function update(nextElement, states = {}, options = {}) {
    if (element && element !== nextElement) update(element);
    element = nextElement;
    if (!element) return;
    const config = getConfig();
    const next = new Set();
    for (const [state, active] of Object.entries(states)) {
      if (!active) continue;
      const key = `class${state[0].toUpperCase()}${state.slice(1)}`;
      const value = options[key] === undefined ? config[key] : options[key];
      if (typeof value === "string") {
        value
          .split(/\s+/)
          .filter(Boolean)
          .forEach((name) => next.add(name));
      }
    }
    let owned = elements.get(element);
    if (!owned) elements.set(element, (owned = new Map()));
    for (const name of current) {
      if (next.has(name)) continue;
      const entry = owned.get(name);
      if (--entry.count === 0) {
        if (!entry.existing) element.classList.remove(name);
        owned.delete(name);
      }
    }
    for (const name of next) {
      if (!current.has(name)) {
        let entry = owned.get(name);
        if (!entry) {
          entry = { count: 0, existing: element.classList.contains(name) };
          owned.set(name, entry);
        }
        entry.count++;
      }
      element.classList.add(name);
    }
    current = next;
    if (!owned.size) elements.delete(element);
  }

  return { update, clear: () => update(element) };
}
