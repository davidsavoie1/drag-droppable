export interface TouchOptions {
  /** Enable edge scrolling during synthetic touch drags. Default true. */
  autoScroll?: boolean;
  /** Edge activation zone in pixels. Default 40. */
  scrollSensitivity?: number;
  /** Maximum scrolling speed in pixels per second. Default 1000. */
  scrollSpeed?: number;
  dragImageOpacity?: number;
  moveThreshold?: number;
  pressHold?: number;
  pressHoldMargin?: number;
  vibration?: number | number[] | boolean | null;
}

export type TouchConfig = boolean | null | TouchOptions;
export type AttributesPrefix = string | false | null;
export type DisabledOptions = false | null | undefined | 0 | "";

export interface DnDConfig {
  attributesPrefix?: AttributesPrefix;
  /** Height fraction of each top/bottom zone. Default 0.5; <=0 disables; capped at 0.5. */
  bottomTopThreshold?: number;
  /** Width fraction of each left/right zone. Default 0.5; <=0 disables; capped at 0.5. */
  leftRightThreshold?: number;
  touch?: TouchConfig;
}

/** Each call resolves touch options against defaults, not previous settings. */
export function configureDnD(options?: DnDConfig): void;

/** Returns a shallow copy; the nested touch object is still shared. */
export function getConfig(): {
  attributesPrefix?: AttributesPrefix;
  bottomTopThreshold?: number;
  leftRightThreshold?: number;
  touch: false | null | Required<TouchOptions>;
};

export interface DragContext<Dragged = unknown, Drop = unknown> {
  drag: Dragged;
  drop: Drop;
  namespace: string | null | undefined;
  type: string;
}

export interface DropPosition {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Within the configured left edge zone. Both horizontal flags may be false. */
  left: boolean;
  right: boolean;
  /** Within the configured top edge zone. Both vertical flags may be false. */
  top: boolean;
  bottom: boolean;
}

/** Position fields are absent when no usable target rectangle is available. */
export type DropEvent<Dragged = unknown, Drop = unknown> = DragContext<
  Dragged,
  Drop
> &
  Partial<DropPosition>;

export type DropCallback<Dragged = unknown, Drop = unknown> = (
  event: DropEvent<Dragged, Drop>,
) => void;

/** Acceptance is evaluated on joining, options updates, hover events and drop. */
export type DropPredicate<Dragged = unknown, Drop = unknown> = (
  context: DropEvent<Dragged, Drop>,
) => boolean;

export type ByType<Callback> = Callback | Record<string, Callback | undefined>;

export interface DraggableOptions<Dragged = unknown, Drop = unknown> {
  el?: HTMLElement;
  namespace?: string | null;
  type?: string;
  data?: Dragged;
  disabled?: boolean;
  attributesPrefix?: AttributesPrefix;
  dragEl?: HTMLElement;
  effectAllowed?: DataTransfer["effectAllowed"];
  except?: Element | string | ((target: Element) => boolean);
  handle?: HTMLElement | string;
  touch?: TouchConfig;
  onDrag?: (
    data: Dragged,
    type: string | undefined,
    namespace: string | null | undefined,
  ) => void;
  onDragEnd?: (
    data: Dragged,
    type: string | undefined,
    namespace: string | null | undefined,
  ) => void;
  onDrop?: DropCallback<Dragged, Drop>;
  /** Called on activation and source state changes; replacing the callback does not notify. */
  onChange?: (state: DraggableState) => void;
}

export interface DroppableOptions<Drop = unknown, Dragged = unknown> {
  el?: HTMLElement;
  namespace?: string | null;
  type?: string;
  types?: string[];
  data?: Drop;
  disabled?: boolean;
  attributesPrefix?: AttributesPrefix;
  /** Override the global top/bottom height fraction. Zero disables this axis. */
  bottomTopThreshold?: number;
  /** Override the global left/right width fraction. Zero disables this axis. */
  leftRightThreshold?: number;
  target?: HTMLElement | string;
  /** Called on activation and target state changes; replacing the callback does not notify. */
  onChange?: (state: DroppableState<Drop, Dragged>) => void;
  when?: ByType<DropPredicate<Dragged, Drop>>;
  unless?: ByType<DropPredicate<Dragged, Drop>>;
  onDrop?: ByType<DropCallback<Dragged, Drop>>;
}

/** Flat options for both roles. Data is shared; onDrop handles received drops only. */
export type DnDOptions<Data = unknown, Dragged = unknown> = Omit<
  DraggableOptions<Data>,
  "onDrop" | "onChange"
> &
  Omit<DroppableOptions<Data, Dragged>, "onChange"> & {
    /** Called on activation and combined state changes; replacement does not notify. */
    onChange?: (state: DragDroppableState<Data, Dragged>) => void;
    /** Allow this controller to receive its own drag. Default false. */
    allowSelfDrop?: boolean;
  };

/** The combined store uses the same flat options as the dnd binding. */
export type DragDroppableOptions<
  Data = unknown,
  Dragged = unknown,
> = DnDOptions<Data, Dragged>;

export interface DraggableState {
  dragging: boolean;
  pointerType?: string;
  attributesPrefix?: AttributesPrefix;
}

/**
 * Empty when idle; context and acceptance fields exist during a matching drag.
 * Position fields are removed when leaving the target or after a drop.
 * The corresponding data attributes are only present while accepts is true.
 */
export interface DroppableState<Drop = unknown, Dragged = unknown>
  extends Partial<DragContext<Dragged, Drop>>, Partial<DropPosition> {
  accepts?: boolean | null;
  attributesPrefix?: AttributesPrefix;
  concerned?: boolean;
  dragging?: boolean;
  unconcerned?: boolean;
}

/**
 * Target state combined with source state. `dragging` refers to this element
 * being dragged; `drag`, `drop`, `type`, and hover fields describe incoming drags.
 */
export interface DragDroppableState<Data = unknown, Dragged = unknown>
  extends Omit<DroppableState<Data, Dragged>, "dragging">, DraggableState {}

export type OptionsUpdate<Options> =
  Options | DisabledOptions | ((current: Options) => Options | DisabledOptions);

export interface DnDController<Options, State> {
  bind(element: HTMLElement): void;
  unbind(): void;
  /** Terminal: this controller cannot be bound or updated again. */
  destroy(): void;
  /** Replace all options. The updater receives a shallow copy. Falsy disables. */
  update(options: OptionsUpdate<Options>): void;
  /** Read-only view of current state; repeated reads return the same reference. */
  getSnapshot(): Readonly<State>;
  subscribe(callback: (state: State) => void): () => void;
}

export type DraggableController<
  Dragged = unknown,
  Drop = unknown,
> = DnDController<DraggableOptions<Dragged, Drop>, DraggableState>;

export type DroppableController<
  Drop = unknown,
  Dragged = unknown,
> = DnDController<
  DroppableOptions<Drop, Dragged>,
  DroppableState<Drop, Dragged>
>;

export type DragDroppableController<
  Data = unknown,
  Dragged = unknown,
> = DnDController<
  DragDroppableOptions<Data, Dragged>,
  DragDroppableState<Data, Dragged>
>;

/** The first generic describes this element's shared data; the second, incoming data. */
export function dragDroppable<Data = unknown, Dragged = unknown>(
  options?: DragDroppableOptions<Data, Dragged> | DisabledOptions,
): DragDroppableController<Data, Dragged>;

/** The first generic describes this controller's data; the second, its partner's. */
export function draggable<Dragged = unknown, Drop = unknown>(
  options?: DraggableOptions<Dragged, Drop> | DisabledOptions,
): DraggableController<Dragged, Drop>;

/** The first generic describes this controller's data; the second, its partner's. */
export function droppable<Drop = unknown, Dragged = unknown>(
  options?: DroppableOptions<Drop, Dragged> | DisabledOptions,
): DroppableController<Drop, Dragged>;

export interface DnDBinding<Update> {
  update(options: Update): void;
  destroy(): void;
}

/**
 * Bind flat options directly, also as `use:dnd={options}`. The binding owns
 * a combined controller and destroys it on cleanup. onDrop belongs to the target.
 * The first generic describes this element's shared data; the second, incoming data.
 */
export function dnd<Data = unknown, Dragged = unknown>(
  element: HTMLElement,
  options?: DnDOptions<Data, Dragged> | DisabledOptions,
): DnDBinding<OptionsUpdate<DnDOptions<Data, Dragged>>>;

/** Supplied combined controllers are only unbound on destroy. Update accepts the same instance. */
export function dnd<Data = unknown, Dragged = unknown>(
  element: HTMLElement,
  controller: DragDroppableController<Data, Dragged>,
): DnDBinding<DragDroppableController<Data, Dragged>>;

/** Bind options directly; also usable as a Svelte action. */
export function dndDrag<Dragged = unknown, Drop = unknown>(
  element: HTMLElement,
  options?: DraggableOptions<Dragged, Drop>,
): DnDBinding<OptionsUpdate<DraggableOptions<Dragged, Drop>>>;

/** Supplied controllers are only unbound on destroy. Update accepts the same instance. */
export function dndDrag<Dragged = unknown, Drop = unknown>(
  element: HTMLElement,
  controller: DraggableController<Dragged, Drop>,
): DnDBinding<DraggableController<Dragged, Drop>>;

/** Bind options directly; also usable as a Svelte action. */
export function dndDrop<Drop = unknown, Dragged = unknown>(
  element: HTMLElement,
  options?: DroppableOptions<Drop, Dragged>,
): DnDBinding<OptionsUpdate<DroppableOptions<Drop, Dragged>>>;

/** Supplied controllers are only unbound on destroy. Update accepts the same instance. */
export function dndDrop<Drop = unknown, Dragged = unknown>(
  element: HTMLElement,
  controller: DroppableController<Drop, Dragged>,
): DnDBinding<DroppableController<Drop, Dragged>>;
