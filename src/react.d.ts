import type { RefCallback } from "react";
import type {
  DisabledOptions,
  DraggableController,
  DraggableOptions,
  DraggableState,
  DroppableController,
  DroppableOptions,
  DroppableState,
} from "./index.js";

export interface DnDHookSettings {
  /** Observe state by default. False keeps the initial state and avoids subscriptions. */
  subscribe?: boolean;
}

export interface DnDHookResult<Controller, State> {
  /** Attach to one DOM element. Detachment and Strict Mode cleanup are automatic. */
  ref: RefCallback<HTMLElement>;
  state: Readonly<State>;
  /** Managed by the hook; pass configuration through hook options. */
  controller: Controller;
}

/** The first generic describes the source data; the second, the target data. */
export function useDraggable<Dragged = unknown, Drop = unknown>(
  options?: Omit<DraggableOptions<Dragged, Drop>, "el"> | DisabledOptions,
  settings?: DnDHookSettings,
): DnDHookResult<DraggableController<Dragged, Drop>, DraggableState>;

/** The first generic describes the target data; the second, the source data. */
export function useDroppable<Drop = unknown, Dragged = unknown>(
  options?: Omit<DroppableOptions<Drop, Dragged>, "el"> | DisabledOptions,
  settings?: DnDHookSettings,
): DnDHookResult<
  DroppableController<Drop, Dragged>,
  DroppableState<Drop, Dragged>
>;
