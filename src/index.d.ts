export interface TouchOptions {
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
  touch?: TouchConfig;
}

/** Each call resolves touch options against defaults, not previous settings. */
export function configureDnD(options?: DnDConfig): void;

/** Returns a shallow copy; the nested touch object is still shared. */
export function getConfig(): {
  attributesPrefix?: AttributesPrefix;
  touch: false | null | Required<TouchOptions>;
};

export interface DragContext<Dragged = unknown, Drop = unknown> {
  dragged: Dragged;
  drop: Drop;
  namespace: string | null | undefined;
  type: string;
}

export interface DropPosition {
  x: number;
  y: number;
  dx: number;
  dy: number;
  left: boolean;
  right: boolean;
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

/** Acceptance is evaluated when joining a drag and whenever options are updated. */
export type DropPredicate<Dragged = unknown, Drop = unknown> = (
  dragged: Dragged,
  context: DragContext<Dragged, Drop>,
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
}

export interface DroppableOptions<Drop = unknown, Dragged = unknown> {
  el?: HTMLElement;
  namespace?: string | null;
  type?: string;
  types?: string[];
  data?: Drop;
  disabled?: boolean;
  attributesPrefix?: AttributesPrefix;
  target?: HTMLElement | string;
  when?: ByType<DropPredicate<Dragged, Drop>>;
  unless?: ByType<DropPredicate<Dragged, Drop>>;
  onDrop?: ByType<DropCallback<Dragged, Drop>>;
}

export interface DraggableState {
  dragging: boolean;
  pointerType?: string;
  attributesPrefix?: AttributesPrefix;
}

/**
 * Empty when idle; context and acceptance fields exist during a matching drag.
 * Position fields are removed when leaving the target or after a drop.
 * The corresponding data attributes are only present while canDrop is true.
 */
export interface DroppableState<Drop = unknown, Dragged = unknown>
  extends Partial<DragContext<Dragged, Drop>>, Partial<DropPosition> {
  dragging?: boolean;
  concerned?: boolean;
  unconcerned?: boolean;
  canDrop?: boolean | null;
  attributesPrefix?: AttributesPrefix;
}

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
