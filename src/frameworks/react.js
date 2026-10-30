"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import draggable from "../draggable.js";
import droppable from "../droppable.js";
import dragDroppable from "../dragDroppable.js";
import createSortable from "../sortable.js";
import sortableController from "./sortableController.js";
import { SORTABLE_CONFIG } from "../constants.js";
import { noop } from "../functions.js";

const useCommitEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeInactive = () => noop;

/** Attach a drag source and observe its state. Set subscribe:false for CSS-only use. */
export function useDraggable(options = {}, settings = {}) {
  return useController(draggable, options, settings, "source");
}

/** Attach a drop target and observe its state. Set subscribe:false for CSS-only use. */
export function useDroppable(options = {}, settings = {}) {
  return useController(droppable, options, settings, "target");
}

/** Attach both roles. dragging describes this element, accepts an incoming drag. */
export function useDnD(options = {}, settings = {}) {
  return useController(dragDroppable, options, settings, "combined");
}

/** One stable sortable per list. The identity selector is fixed at creation. */
export function useCreateSortable(options = {}) {
  const [sortable] = useState(() => createSortable(options));
  useCommitEffect(() => { sortable[SORTABLE_CONFIG](options); });
  return sortable;
}

/** Attach one item to a shared sortable. Call in a keyed row component. */
export function useSortable(sortable, options, settings = {}) {
  const [initial] = useState(() => sortable);
  useCommitEffect(() => {
    if (sortable !== initial) throw new Error("Keep the same sortable instance for a mounted item.");
  }, [sortable, initial]);
  return useController(() => sortableController(initial), options, settings, "sortable");
}

function useController(factory, options, { subscribe = true }, kind) {
  /* Unbound controllers have no DOM effects and can safely be created during render. */
  const [binding] = useState(() => createBinding(factory, kind !== "source"));
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
  const current = controller.getSnapshot();
  const state = subscribe && kind !== "source" && Object.hasOwn(current, "drop")
    ? {
        ...snapshot,
        drop: kind === "sortable"
          ? { ...current.drop, data: options.data, index: options.index }
          : options?.data,
      }
    : snapshot;

  return { ref, state, controller };
}

function createBinding(factory, target) {
  const controller = factory();
  let snapshot;

  function getSnapshot() {
    const next = { ...controller.getSnapshot() };
    if (target) delete next.drop;

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
