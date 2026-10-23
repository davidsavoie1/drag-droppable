/* Handlers grouped by namespace and drag type. */
const subscriptionsByKey = new Map();

/* Reference to cleanup functions to call at drag end */
let cleanupFunctions = [];

/* Reference to current drag session */
let currentDrag = null;

export function registerDragCleanup(cleanupFn) {
  cleanupFunctions.push(cleanupFn);
}

/* Register target handlers within a namespace. */
export function registerDragListeners(dragListeners, namespace) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const key = createKey({ namespace, type });
    if (!subscriptionsByKey.has(key)) {
      subscriptionsByKey.set(key, new Set());
    }
    subscriptionsByKey.get(key).add(handler);

    /* New drag handler gets called immediately
     * if a compatible drag session is in process. */
    if (currentDrag && createKey(currentDrag) === key) {
      handler(currentDrag);
    }
  });
}

/* Remove target handlers and discard empty groups. */
export function unregisterDragListeners(dragListeners, namespace) {
  Object.entries(dragListeners).forEach(([type, handler]) => {
    const key = createKey({ namespace, type });
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
export function publishDrag(dragSession) {
  currentDrag = dragSession;

  const { namespace, type, data, onDrop } = dragSession;

  const key = createKey({ namespace, type });

  const handlers = getSubscriptions(key);

  handlers?.forEach((handler) => handler({ namespace, type, data, onDrop }));

  return function dragEndCleanup() {
    const cleanups = cleanupFunctions;
    cleanupFunctions = [];
    currentDrag = null;

    cleanups.forEach((fn) => fn?.());
  };
}

function createKey({ namespace, type }) {
  return JSON.stringify({ namespace: namespace ?? "", type: type ?? "" });
}
