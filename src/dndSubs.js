/* Handlers grouped by namespace and drag type. */
const subscriptionsByKey = new Map();

/* Register target handlers within a namespace. */
export function registerDragListeners(dragListeners, namespace) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const key = createKey(namespace, type);
    if (!subscriptionsByKey.has(key)) {
      subscriptionsByKey.set(key, new Set());
    }
    subscriptionsByKey.get(key).add(handler);
  });
}

/* Remove target handlers and discard empty groups. */
export function unregisterDragListeners(dragListeners, namespace) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const key = createKey(namespace, type);
    const set = subscriptionsByKey.get(key);
    if (!set) return;
    set.delete(handler);

    if (set.size < 1) {
      subscriptionsByKey.delete(key);
    }
  });
}

/* Snapshot listeners so registration changes do not affect this publication. */
function getSubscriptions(key) {
  const set = subscriptionsByKey.get(key);
  if (!set) return [];
  return Array.from(set);
}

/* Notify matching targets and collect their end-of-drag cleanup functions. */
export function publishDrag({ namespace, type, data, onDrop }) {
  const key = createKey(namespace, type);

  const dragListeners = getSubscriptions(key);
  if (dragListeners?.length < 1) return;

  const cleanupFunctions = dragListeners.map((handler) =>
    handler({ namespace, type, data, onDrop }),
  );

  return function dragEndCleanup() {
    cleanupFunctions.forEach((fn) => fn?.());
  };
}

function createKey(namespace, type) {
  return JSON.stringify({ namespace: namespace ?? "", type: type ?? "" });
}
