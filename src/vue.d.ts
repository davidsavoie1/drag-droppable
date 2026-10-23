import type { MaybeRefOrGetter, ShallowRef } from "vue";
import type {
  DisabledOptions,
  DraggableController,
  DraggableOptions,
  DraggableState,
  DroppableController,
  DroppableOptions,
  DroppableState,
} from "./index.js";

export interface DnDComposableSettings {
  /** Observe state by default. False keeps the initial idle state. */
  subscribe?: boolean;
}

export interface DnDComposableResult<Controller, State> {
  /** Assign to one HTML element using a Vue template ref. */
  ref: ShallowRef<HTMLElement | null>;
  state: Readonly<ShallowRef<Readonly<State>>>;
  /** Owned by the composable; configure it through options. */
  controller: Controller;
}

/** Call in setup. The first generic describes source data; the second, target data. */
export function useDraggable<Dragged = unknown, Drop = unknown>(
  options?: MaybeRefOrGetter<
    Omit<DraggableOptions<Dragged, Drop>, "el"> | DisabledOptions
  >,
  settings?: MaybeRefOrGetter<DnDComposableSettings>,
): DnDComposableResult<DraggableController<Dragged, Drop>, DraggableState>;

/** Call in setup. The first generic describes target data; the second, source data. */
export function useDroppable<Drop = unknown, Dragged = unknown>(
  options?: MaybeRefOrGetter<
    Omit<DroppableOptions<Drop, Dragged>, "el"> | DisabledOptions
  >,
  settings?: MaybeRefOrGetter<DnDComposableSettings>,
): DnDComposableResult<
  DroppableController<Drop, Dragged>,
  DroppableState<Drop, Dragged>
>;
