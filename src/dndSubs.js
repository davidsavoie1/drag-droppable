/* [key]: Set[handlers] */
const subscriptionsByKey = new Map();

/* FOR DROPPABLES */

/* Add each handler by type to `subscriptionsByType`. */
export function registerDragListeners(
  dragListeners, // { ...[type]: function handler() { return () => cleanUp; } },
  namespace,
) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const key = createKey(namespace, type);
    if (!subscriptionsByKey.has(key)) {
      subscriptionsByKey.set(key, new Set());
    }
    subscriptionsByKey.get(key).add(handler);
  });
}

/* Add each handler by type from `subscriptionsByType`. */
export function unregisterDragListeners(
  dragListeners, // { ...[type]: function handler() { return () => cleanUp; } }
  namespace,
) {
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

/* FOR DRAGGABLES */

/* Get all handlers for a given namespace-type key, as array */
function getSubscriptions(key) {
  const set = subscriptionsByKey.get(key);
  if (!set) return [];
  return Array.from(set);
}

export function publishDrag({ namespace, type, data, onDrop }) {
  const key = createKey(namespace, type);

  const dragListeners = getSubscriptions(key);
  if (dragListeners?.length < 1) return;

  /* Each handler is supposed to return a cleanup function. */
  const cleanupFunctions = dragListeners.map((handler) =>
    handler({ namespace, type, data, onDrop }),
  );

  /* Return a cleanup function that can be called to execute
   * each handlers' cleanup function. */
  return function dragEndCleanup() {
    cleanupFunctions.forEach((fn) => fn?.());
  };
}

function createKey(namespace, type) {
  return JSON.stringify({ namespace: namespace ?? "", type: type ?? "" });
}
