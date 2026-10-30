import { isElement, isFunc } from "../functions.js";

/* Give framework adapters the same lifecycle/observation interface as controllers.
 * Bindings are recreated only when their element detaches, never on option updates. */
export default function sortableController(sortable) {
  let element;
  let binding;
  let options;
  let onChange;
  let destroyed = false;
  let creating = false;
  let state = { dragging: false };
  const subscribers = new Set();

  function publish(next) {
    const keys = new Set([...Object.keys(state), ...Object.keys(next)]);
    if ([...keys].every((key) => Object.is(state[key], next[key]))) return;
    state = next;
    onChange?.(state);
    subscribers.forEach((callback) => callback(state));
  }

  function attach() {
    if (!element || !options || binding || creating || destroyed) return;
    const node = element;
    const current = options;
    creating = true;
    let created;
    try {
      created = sortable(node, { ...options, onChange: publish });
    } finally {
      creating = false;
    }
    if (destroyed || element !== node) {
      created.destroy();
    } else {
      binding = created;
      if (options !== current) binding.update({ ...options, onChange: publish });
    }
  }

  function unbind() {
    const previous = binding;
    binding = undefined;
    element = undefined;
    previous?.destroy();
    publish({ dragging: false });
  }

  return {
    bind(node) {
      if (destroyed) throw new Error("Cannot bind a destroyed sortable controller.");
      if (!isElement(node)) throw new TypeError("Expected an HTML element.");
      if (element && element !== node) throw new Error("Unbind before changing elements.");
      element = node;
      attach();
    },
    unbind,
    update(next) {
      if (destroyed) throw new Error("Cannot update a destroyed sortable controller.");
      if (!next || !Number.isInteger(next.index) || next.index < 0) {
        throw new Error("Sortable item options require a nonnegative index.");
      }
      const previousOnChange = onChange;
      options = { ...next };
      const current = options;
      onChange = isFunc(options.onChange) ? options.onChange : undefined;
      if (!previousOnChange) onChange?.(state);
      if (destroyed || options !== current) return;
      if (binding) binding.update({ ...options, onChange: publish });
      else attach();
    },
    getSnapshot: () => state,
    subscribe(callback) {
      if (!isFunc(callback)) throw new TypeError("Expected a subscriber function.");
      callback(state);
      if (destroyed) return () => {};
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        unbind();
      } finally {
        onChange = undefined;
        subscribers.clear();
      }
    },
  };
}
