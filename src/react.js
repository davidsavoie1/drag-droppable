"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import draggable from "./draggable.js";
import droppable from "./droppable.js";
import { noop } from "./functions.js";

const useCommitEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeInactive = () => noop;

/** Attach a drag source and observe its state. Set subscribe:false for CSS-only use. */
export function useDraggable(options = {}, settings = {}) {
  return useDnD(draggable, options, settings);
}

/** Attach a drop target and observe its state. Set subscribe:false for CSS-only use. */
export function useDroppable(options = {}, settings = {}) {
  return useDnD(droppable, options, settings);
}

function useDnD(factory, options, { subscribe = true }) {
  /* Unbound controllers have no DOM effects and can safely be created during render. */
  const [binding] = useState(() => createBinding(factory));
  const { controller, getSnapshot, getServerSnapshot } = binding;
  const element = useRef(null);

  const ref = useCallback(
    (node) => {
      if (element.current === node) return;
      controller.unbind();
      element.current = node;
      if (node) controller.bind(node);
    },
    [controller],
  );

  /* Apply committed options only; abandoned renders must not affect an active drag. */
  useCommitEffect(() => {
    controller.update(options);
  });

  useCommitEffect(() => {
    if (element.current) controller.bind(element.current);
    /* Unbind rather than destroy: Strict Mode replays setup with this controller. */
    return () => controller.unbind();
  }, [controller]);

  const snapshot = useSyncExternalStore(
    subscribe ? controller.subscribe : subscribeInactive,
    subscribe ? getSnapshot : getServerSnapshot,
    getServerSnapshot,
  );

  /* Drop data already comes from this render's options. Observing it again would
   * loop when inline data objects are recreated after each store notification. */
  const state =
    factory === droppable && snapshot.dragging
      ? { ...snapshot, drop: options?.data }
      : snapshot;

  return { ref, state, controller };
}

function createBinding(factory) {
  const controller = factory();
  let snapshot;

  function getSnapshot() {
    const next = { ...controller.getSnapshot() };
    if (factory === droppable) delete next.drop;

    if (
      !snapshot ||
      Object.keys(next).length !== Object.keys(snapshot).length ||
      Object.keys(next).some((key) => !Object.is(next[key], snapshot[key]))
    ) {
      snapshot = next;
    }
    return snapshot;
  }

  const initial = getSnapshot();
  return { controller, getSnapshot, getServerSnapshot: () => initial };
}
