import type { MaybeRefOrGetter, ShallowRef } from "vue";
import type {
  DisabledOptions,
  DnDOptions,
  DragDroppableController,
  DragDroppableState,
  SortableAction,
  SortableOptions,
  SortableItemController,
  SortableItemOptions,
  SortableItemState,
  DraggableController,
  DraggableOptions,
  DraggableState,
  DroppableController,
  DroppableOptions,
  DroppableState,
} from "../index.js";

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


/** Combined source and target roles, with the same flat options as dnd. */
export function useDnD<Data = unknown, Dragged = unknown>(
  options?: MaybeRefOrGetter<Omit<DnDOptions<Data, Dragged>, "el"> | DisabledOptions>,
  settings?: MaybeRefOrGetter<DnDComposableSettings>,
): DnDComposableResult<DragDroppableController<Data, Dragged>, DragDroppableState<Data, Dragged>>;

/** Create once per list; a getter keeps callbacks and rules reactive. dataToId is initial-only. */
export function useCreateSortable<
  Key extends string | number,
  Data extends Record<Key, unknown> = Record<Key, unknown>,
>(
  options: MaybeRefOrGetter<Omit<SortableOptions<Data, Data[Key]>, "dataToId"> & { dataToId: Key }>,
): SortableAction<Data, Data[Key]>;

export function useCreateSortable<Data, Id>(
  options: MaybeRefOrGetter<Omit<SortableOptions<Data, Id>, "dataToId"> & { dataToId: (data: Data) => Id }>,
): SortableAction<Data, Id>;

export function useCreateSortable<Data = unknown>(
  options?: MaybeRefOrGetter<Omit<SortableOptions<Data, Data>, "dataToId"> & { dataToId?: undefined }>,
): SortableAction<Data, Data>;

export function useCreateSortable<Data = unknown, Id = unknown>(
  options: MaybeRefOrGetter<SortableOptions<Data, Id>>,
): SortableAction<Data, Id>;

/** Call in each row's setup, using a shared list action and reactive item options. */
export function useSortable<Data = unknown, Id = unknown>(
  sortable: SortableAction<Data, Id>,
  options: MaybeRefOrGetter<SortableItemOptions<Data, Id>>,
  settings?: MaybeRefOrGetter<DnDComposableSettings>,
): DnDComposableResult<SortableItemController<Data, Id>, SortableItemState<Data, Id>>;
