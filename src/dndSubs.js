/* [key]: Set[handlers] */
const subscriptionsByType = new Map();

/* FOR DROPPABLES */

/* Add each handler by type to `subscriptionsByType`. */
export function registerDragListeners(
  dragListeners, // { ...[type]: function handler() { return () => cleanUp; } }
) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    if (!subscriptionsByType.has(type)) {
      subscriptionsByType.set(type, new Set());
    }
    subscriptionsByType.get(type).add(handler);
  });
}

/* Add each handler by type from `subscriptionsByType`. */
export function unregisterDragListeners(
  dragListeners, // { ...[type]: function handler() { return () => cleanUp; } }
) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const set = subscriptionsByType.get(type);
    if (!set) return;
    set.delete(handler);

    if (set.size < 1) {
      subscriptionsByType.delete(type);
    }
  });
}

/* FOR DRAGGABLES */

/* Get all handlers for a given type, as array */
function getSubscriptions(type) {
  const set = subscriptionsByType.get(type);
  if (!set) return [];
  return Array.from(set);
}

export function publishDrag({ type, data, onDrop }) {
  const dragListeners = getSubscriptions(type);
  if (dragListeners?.length < 1) return;

  /* Each handler is supposed to return a cleanup function. */
  const cleanupFunctions = dragListeners.map((handler) =>
    handler({ type, data, onDrop }),
  );

  /* Return a cleanup function that can be called to execute
   * each handlers' cleanup function. */
  return function dragEndCleanup() {
    cleanupFunctions.forEach((fn) => fn?.());
  };
}
