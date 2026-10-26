# Drag-droppable

Lightweight, data-driven, framework-independent drag-and-drop system with touch support and reactive stores.

Attach data to draggable and droppable elements and use it to handle the drops. Drop targets react only to relevant drags based on namespace, type and respective data.

**You decide how to represent the drag-and-drop interactions**... with a lot of information to do so! The library doesn't include any built-in styling that would get in the way (it would, it always does).

**You decide how to handle drops**... with a lot of information to do so! No HTML mutation will actually move anything around permanently, preventing inconsistencies with the actual state of your app (it would, it always does).

**You choose your favorite framework**. Although the library has been developped with Svelte in mind, it will work fine in React, Vue and even plain old Javascript. Optional React hooks and Vue composables are even provided!

**You can use it with touch support out of the box** without any adapter or workaround... and you can configure it as you like.

The core has no dependencies, only a few kB of modern Javascript. Optional React hooks and Vue composables use your application's framework installation.

## Table of contents

- [Table of contents](#table-of-contents)
- [Typical usage](#typical-usage)
- [Using `onDrop`](#using-ondrop)
- [Draggable](#draggable)
- [Droppable](#droppable)
- [Draggable and droppable](#draggable-and-droppable)
- [Stores](#stores)
- [Dynamic configuration](#dynamic-configuration)
- [Global configuration](#global-configuration)
- [Data attributes](#data-attributes)
- [Touch](#touch)
- [Lifecycle](#lifecycle)
- [Limitations](#limitations)
- [Usage in Svelte (optional)](#usage-in-svelte-optional)
- [Usage in React (optional)](#usage-in-react-optional)
- [Usage in Vue (optional)](#usage-in-vue-optional)
- [Examples](#examples)
- [TypeScript](#typescript)

## Typical usage

The following example showcases a baby (a drop target element) and a variety of things it could bring to its mouth (drag elements). Data involved in the process allow deciding what can go in the mouth or not. Styling these interactions is left to the app code. No HTML mutation will actually move anything around permanently.

```js
import { dndDrag, dndDrop } from "drag-droppable";

/* All HTML elements in the example are made available based on the runtime
 * (Svelte, React, plain JS, etc.) */

/* Droppable element */

let babySleeps = false;

dndDrop(babyMouthEl, {
  /* Accepted drag types */
  types: ["food"],

  /* Drop can be completely disabled */
  disabled: babySleeps,

  /* Drop can be accepted conditionally based on drag element */
  when: (food) => food.tastes.includes("sweet"),
  unless: (food) => food.texture === "solid",

  /* Do something after drop */
  onDrop({ dragged: food }) {
    eatFood(food);
  },
});

/* Draggable elements */

/* Rejected: wrong taste and texture */
dndDrag(saltyFoodEl, {
  type: "food",
  data: { tastes: ["salty"], texture: "solid" },
});

/* Accepted! Miam! */
dndDrag(pureeEl, {
  type: "food",
  data: { tastes: ["sweet"], texture: "smooth" },
});

/* Rejected: wrong type */
dndDrag(toyEl, {
  type: "toy",
  data: { color: "red" },
});
```

## Using `onDrop`

An `onDrop` callback will be called when a drop successfully occurs, either from the perspective of:

- the dragged then dropped element (draggable);
- the element that received the dropped element (droppable).

In both cases, the function receives the same arguments. With the combined `dnd` binding, `onDrop` belongs only to the target:

```js
onDrop(
  ({
    dragged, // Dragged data.
    drop, // Drop data.
    namespace, // Namespace of drag-and-drop.
    type, // Dragged element type.

    /* Positionning */
    x, // x position on drop element, in px.
    y, // y position on drop element, in px.
    dx, // x position on drop element, in ratio between 0 and 1.
    dy, // y position on drop element, in ratio between 0 and 1.
    left, // Within the configured left zone.
    right, // Within the configured right zone.
    top, // Within the configured top zone.
    bottom, // Within the configured bottom zone.
  }) => {},
);
```

## Draggable

An element can be declared draggable with `dndDrag`.

```js
import { dndDrag } from "drag-droppable";

const {
  destroy, // ()
  update, // (newConfiguration)
} = dndDrag(HTMLElement, {
  /* Most relevant */
  namespace,
  type,
  data,
  disabled,

  /* Handling */
  onDrag,
  onDragEnd,
  onDrop,

  /* Configuration */
  attributesPrefix,
  dragEl,
  effectAllowed,
  except,
  handle,
  touch,
});
```

### Most relevant

**`namespace`**: Only draggable and droppable in the same namespace can interact with each other. `null` and `undefined` namespace is treated as `""`. Optionnal.

**`type`**: Type of draggable element. Only droppables that include it in their `types` will react to it.

**`data`**: Data the dragged element carries with it. Passed as the first argument of `unless` and `when`, and as `dragged` in the `onDrop` callback argument.

**`disabled`**: Disabled draggable element cannot be dragged.

### Handling

**`onDrag(data, type, namespace)`**: Function to execute when a drag is initiated.

**`onDragEnd(data, type, namespace)`**: Function to execute when a drag ends, whether it resulted in a successful drop or was cancelled. Receives the data, type and namespace captured when the drag started. Use `onDrop` for successful drops and `onDragEnd` for end-of-drag cleanup.

**`onDrop({ ...onDropArgs })`**: Function to execute when dragged element is dropped. See [`onDrop`](#ondrop).

### Configuration

**`attributesPrefix`**: Data attributes prefix to use. See [Data attributes](#data-attributes).

**`dragEl`**: HTML element to use as a drag image. Defaults to the bound element.

**`effectAllowed`**: HTML5 drag `dataTransfer.effectAllowed` configuration.

**`except`**: What to ignore when initiating a drag. Element, CSS selector or function.

**`handle`**: HTML element used to initiate drag. Defaults to the bound element.

**`touch`**: Touch configuration local override. See [Touch](#touch).

### Returns

**`destroy()`**: A function to destroy the draggable functionalities and remove handlers.

**`update(configOrFunction)`**: Replace the draggable configuration, directly or through an updater function. See [Dynamic configuration](#dynamic-configuration).

## Droppable

An element can be declared as a potential dropzone with `dndDrop`.

```js
import { dndDrop } from "drag-droppable";

const {
  destroy, // ()
  update, // (newConfiguration)
} = dndDrop(HTMLElement, {
  /* Most relevant */
  namespace,
  types,
  type,
  data,
  disabled,

  /* Handling */
  onDrop,
  unless,
  when,

  /* Configuration */
  attributesPrefix,
  bottomTopThreshold,
  leftRightThreshold,
  target,
});
```

### Most relevant

**`namespace`**: Only draggable and droppable in the same namespace can interact with each other. `null` and `undefined` namespace is treated as `""`. Optionnal.

**`types`**: Types of draggable elements accepted by the droppable.

**`type`**: Shorthand when accepting a single type.

**`data`**: Data associated with the drop element. Available as `drop` in the second argument of `when` and `unless`, in the `onDrop` callback argument, and in the subscribed state.

**`disabled`**: Disabled droppable element cannot accept drops.

### Handling

**`onDrop({ ...onDropArgs })`**: Function to execute when dragged element is dropped. See [`onDrop`](#ondrop).

**`unless(draggedData, context)`**: Predicate function that prevents drop when true.

**`when(draggedData, context)`**: Predicate function that allows drop only when true.

Both receive the dragged data first, then a context object containing `{ dragged, drop, namespace, type }`. For example:

```js
when: (food, { drop: baby }) => baby.hunger > 0 && food.texture === "smooth";
```

For matching types and namespaces, predicates are evaluated at the start of the drag or when the droppable is registered or updated during a drag. They are not continuously re-evaluated during hover.

Each of them can also be defined as an object with a different handler for each type.

```js
import { dndDrop } from "drag-droppable";

dndDrop(HTMLElement, {
  types: ["food", "toy"],
  when: {
    food: (food) => food.texture === "smooth",
    toy: (toy) => toy.size < 42,
  },
  onDrop: {
    food: ({ dragged }) => eatFood(dragged),
    toy: spitOut, // Receives complete dnd data, including positionning
  },
});
```

### Configuration

**`attributesPrefix`**: Data attributes prefix to use. See [Data attributes](#data-attributes).

**`target`**: Which element to use as drop target. Element or CSS selector.

**`bottomTopThreshold`** and **`leftRightThreshold`**: Override the global [position thresholds](#position-thresholds) for this droppable. Omitted or `undefined` values inherit the global settings; zero disables the corresponding axis.

```js
import { dndDrop } from "drag-droppable";

dndDrop(babyMouthEl, {
  type: "food",
  bottomTopThreshold: 0.2,
  leftRightThreshold: 0 /* Dinner has no left or right wing. */,
  onDrop: feedBaby,
});
```

### Returns

**`destroy()`**: A function to destroy the droppable functionalities and remove handlers.

**`update(configOrFunction)`**: Replace the droppable configuration, directly or through an updater function. See [Dynamic configuration](#dynamic-configuration).

## Draggable and droppable

Use `dnd(element, options)` when the same element is both a drag source and a drop target for the same namespace and type. It also works as a Svelte action:

```svelte
<script>
  import { dnd } from "drag-droppable";
</script>

<div
  use:dnd={{
    type: "baby",
    data: { name: "Mia" },
    unless: (dragged, { drop }) => dragged === drop,
    onDrop: ({ dragged, drop }) => console.log(dragged, "visits", drop),
  }}
>
  Baby Mia
</div>
```

The flat configuration combines draggable and droppable options. `data`, `namespace`, `disabled`, and `attributesPrefix` apply to both roles. `type` defines the emitted type and, by default, the accepted type. Set `types` to override accepted types independently: `{ type: "baby", types: ["baby", "toy"] }` emits `"baby"` and accepts `"baby"` or `"toy"`.

**`onDrop` handles drops only**, including callbacks defined by type. `onDrag` and `onDragEnd` keep their usual source behavior.

`dnd` accepts options or an existing `dragDroppable` store and returns `update()` and `destroy()`. With options, it creates and owns a combined store. Updates follow the same replacement and updater-function rules as the other bindings; `disabled` disables both roles.

To create the store separately, use `dragDroppable(options)`, then bind it with `dnd(element, store)`, `use:dnd={store}`, or `store.bind(element)`. A binding created from a supplied store only unbinds it on cleanup; update configuration through the store and keep passing the same instance.

For different data or namespaces for each role, or a source-side `onDrop`, use `dndDrag` and `dndDrop` separately.

## Stores

A store can be created separately, then passed to its corresponding binding function or manually bound to an HTML element:

- `draggable(options)` => `dndDrag(element, store)`
- `droppable(options)` => `dndDrop(element, store)`
- `dragDroppable(options)` => `dnd(element, store)`

All stores expose the same methods:

- **`bind(element)`**: Bind to an HTML element. Rebinding to the same element is allowed, but switching to a different element requires `unbind()` first.

- **`unbind()`**: Detach from the currently bound element without destroying the store.

- **`update(configOrFunction)`**: Replace the whole configuration. An updater function receives a shallow copy of the current configuration and returns its replacement. Passing or returning a falsy value resets the configuration to `{ disabled: true }`. See [Dynamic configuration](#dynamic-configuration).

- **`subscribe(cb)`**: Immediately receive the current state, then subsequent changes. Returns an unsubscribe function. The state differs by store; `droppable` and `dragDroppable` include the incoming drag's position. See [`onDrop`](#ondrop) for details.

- **`getSnapshot()`**: Read the current state without subscribing. Returns the same object reference until the store replaces its state. Treat this object as read-only; it is not a copy.

- **`destroy()`**: Fully tear down the store.

```js
import { dndDrag, dndDrop, draggable, droppable } from "drag-droppable";

const dragStore = draggable({/* dndDrag second argument */});
dndDrag(dragHTMLElement, dragStore);

dragStore.subscribe(
  ({
    dragging, // Is this element being dragged?
    pointerType, // Last `event.pointerType`
  }) => {
    /* Do something with this information */
  },
);

const dropStore = droppable({/* dndDrop second argument */});
dndDrop(dropHTMLElement, dropStore);

dropStore.subscribe(
  ({
    canDrop, // Is relevant dragged element over drop element?
    concerned, // Is relevant element being dragged?
    dragged, // Dragged data.
    dragging, // Is a matching drag in progress?
    drop, // Drop data.
    type, // Dragged element type.
    unconcerned, // Drag of interest, but refused by `unless` and `when` predicates.

    ...positionning // See `onDrop` documentation
  }) => {
    /* Do something with this information */
  },
);
```

`dragDroppable` combines both states. **`dragging` always describes this element being dragged**, and `pointerType` comes from its source role. `concerned`, `unconcerned`, `canDrop`, `dragged`, `drop`, `type`, and position fields describe its target role. Receiving a drag from another element does not set `dragging` to true; use the target fields to react to incoming drags.

```js
import { dnd, dragDroppable } from "drag-droppable";

const babyStore = dragDroppable({ type: "baby", data: { name: "Mia" } });
const binding = dnd(babyEl, babyStore);

const unsubscribe = babyStore.subscribe(({ dragging, canDrop }) => {
  /* React to Mia being moved or receiving another baby. */
});

/* Later: detach both roles. The store can be bound again. */
unsubscribe();
binding.destroy();
```

The snapshot is the same state object delivered to subscribers:

```js
const current = dropStore.getSnapshot();
console.log(current.canDrop);

/* Reading does not create a new snapshot. */
console.log(current === dropStore.getSnapshot()); // true
```

Together, `subscribe` and `getSnapshot` provide the client-side store interface used by React's `useSyncExternalStore`. React is not a dependency of the library.

Snapshots are not frozen or deeply cloned. Application data in `dragged` and `drop` retains its original references; mutating that data alone does not notify subscribers. Update configuration through `update()` and let the library manage the store's state fields.

## Dynamic configuration

The argument used for initial configuration might change at runtime. For example, having a `disabled` draggable can be useful, but it probably should be based on a condition that could change.

`dnd`, `dndDrag`, `dndDrop`, `draggable`, `droppable`, and `dragDroppable` all return an `update()` method.

An object argument replaces the entire configuration; omitted options are not preserved.

An updater function receives a shallow copy of the current configuration and must return the replacement. Spread the current configuration to retain options you do not want to change. The copy passed to the updater is shallow: nested objects, including `data`, still share their original references.

Passing or returning a falsy value resets the configuration to `{ disabled: true }`; it does not preserve options for later reactivation.

```js
const baby = dndDrop(babyMouthEl, {
  type: "food",
  data: { name: "Mia", hunger: 6 },
  onDrop: feedBaby,
});

/* Replace all options. */
baby.update({
  type: "food",
  data: { name: "Mia", hunger: 3 },
  onDrop: feedBaby,
});

/* Preserve the other options. The baby needs a nap. */
baby.update((current) => ({ ...current, disabled: true }));

/* Replace only the data, keeping the other options. */
baby.update((current) => ({
  ...current,
  data: { ...current.data, hunger: 6 },
}));
```

In Svelte, the `use:` directive handles these changes directly using `update` internally when configuration is passed as second argument.

```svelte
<script>
  import { dndDrag, dndDrop } from "drag-droppable";

  let { babySleeps } = $props();
</script>

<div use:dndDrag={{ type: "toy" }}>Red Truck Toy</div>

<div
  use:dndDrop={{
    types: ["food", "toy"],
    disabled: babySleeps /* Updates reactively. */,
  }}
>
  Baby Mouth
</div>
```

When an existing store is passed to a Svelte action, update its configuration through the store's `update()` method. The action keeps using that same store instance.

Droppables added, re-enabled, or updated during a drag immediately evaluate the active drag against their current type, namespace, and acceptance conditions. Updates preserve hover state and position while the same target element remains accepting. If the target changes or stops accepting the drag, its hover state is cleared. Newly added or reactivated targets need a `dragover` event before they can receive a drop.

## Global configuration

No configuration is required to get started. Use `configureDnD()` to change defaults shared by the library:

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  /* Default values */
  attributesPrefix: "dnd",
  bottomTopThreshold: 0.5,
  leftRightThreshold: 0.5,
  touch: true,
});
```

**`attributesPrefix`** sets the prefix for [data attributes](#data-attributes). For example, `"dd"` produces `data-dd-*`; a falsy value disables these attributes by default. Individual draggable and droppable options can override the prefix.

**`touch`** controls touch drag-and-drop defaults. See [Touch](#touch) for its options and local override rules.

Repeated calls preserve omitted non-touch settings. Touch settings revert to their defaults before applying the supplied touch configuration.

### Position thresholds

**`bottomTopThreshold`**: Height fraction occupied by each top/bottom edge zone.

**`leftRightThreshold`**: Width fraction occupied by each left/right edge zone.

Both default to `0.5`, splitting the target in halves. A threshold of `0.2` creates two 20% edge zones and a neutral 60% center where neither flag on that axis is true. Zero or a negative value disables both flags on the axis. Values above `0.5` are capped at `0.5`, so opposite zones never overlap.

For example, with `leftRightThreshold: 0.2`, `left` is true when `dx < 0.2` and `right` when `dx >= 0.8`. Top/bottom use the same rules with `dy`. At the default midpoint, the exact center belongs to right/bottom.

```js
configureDnD({
  bottomTopThreshold: 0.2,
  leftRightThreshold: 0.2,
});
```

These defaults apply to droppables unless they specify a [local override](#droppable). Thresholds only affect the `left`, `right`, `top`, and `bottom` flags and their data attributes. Drops can still be accepted in the neutral center.

## Data attributes

The library doesn't include any styling, only data that can be used to apply styles. To simplify this process, some properties are attached to the bound elements using data attributes. By default, these attributes start with `data-dnd-`. Available attributes are:

**Draggable**

- `data-dnd-draggable-namespace`: Draggable namespace
- `data-dnd-draggable-type`: Draggable type
- `data-dnd-draggable`: Present when element is active draggable
- `data-dnd-dragging`: Present when element is being dragged

**Droppable**

- `data-dnd-droppable-namespace`: Droppable namespace
- `data-dnd-dragged-type`: Dragged element type
- `data-dnd-droppable`: Present when element is active droppable with at least one type
- `data-dnd-concerned`: Present when dragged element is relevant
- `data-dnd-unconcerned`: Present when potentially relevant dragged element is rejected by `unless` or `when` predicates
- `data-dnd-can`: Present when dragged element is relevant and is over droppable element
- `data-dnd-top` / `data-dnd-bottom`: Present during an accepted hover within the configured top/bottom zone.
- `data-dnd-left` / `data-dnd-right`: Present during an accepted hover within the configured left/right zone.

Position attributes follow the [position thresholds](#position-thresholds) and are removed outside the corresponding zones or when the hover ends.

Boolean attributes are either present or not. CSS can then easily target these attributes.

```css
/* Draggable element is being dragged */
[data-dnd-draggable][data-dnd-dragging] {
  outline: solid 2px black;
}

/* Droppable element is concerned */
[data-dnd-droppable][data-dnd-concerned] {
  outline: dashed 2px #0e7490;
}

/* Droppable element can accept drop */
[data-dnd-droppable][data-dnd-can] {
  background-color: #67e8f9;
}

/* Droppable element could have been concerned, but refuses it at runtime. */
[data-dnd-droppable][data-dnd-unconcerned] {
  outline: solid 1px red;
}
```

When using these data attributes in embedded Svelte styles, they should be wrapped in `:global()` CSS modifier and used in conjunction with a local component identifier (to prevent creating a truly global CSS rule from a component).

```CSS
el.some-local-identifier:global([data-dnd-draggable]) {
  /* Some CSS rules */
}
```

The prefix can be changed globally or overridden on individual elements. See [Global configuration](#global-configuration).

## Touch

Touch devices need a special treatment for drag-and-drop to work correctly. The native drag-and-drop API doesn't apply to touch, so the library implements synthetic drag and drop events for a unified experience.

To prevent unwanted behaviour such as initating a drag when scrolling content for example, some parameters are checked to consider a drag. They can be configured with `configureDnD`, under the `touch` key.

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  touch: {
    /* Default values */
    autoScroll: true, // Scroll near the edges during touch drags.
    scrollSensitivity: 40, // Edge activation zone, in pixels.
    scrollSpeed: 1000, // Maximum scroll speed, in pixels per second.
    dragImageOpacity: 0.5, // Opacity of the image created to follow the touch.
    moveThreshold: 5, // Minimum movement in pixels to consider a drag valid.
    pressHold: 300, // Number of milliseconds to statically hold before initiating drag.
    pressHoldMargin: 5, // Tolerance in pixels while holding. Moving more cancels drag.
    vibration: 10, // Vibration pattern used in `navigator.vibrate`.
  },
});
```

Only some properties can be set; they will get merged with the default one.

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  touch: {
    vibration: [20, 10, 20],
    /* All other values revert to defaults */
  },
});
```

Setting `touch` to `false` in the global configuration will disable all touch drag-and-drop behaviours. Non-touch drag-and-drop will still be possible.

Setting `touch` to `null` in the global configuration will by default disable touch drag-and-drop behaviours, but individual draggable configurations can activate it locally. Non-touch drag-and-drop will still be possible.

Setting `touch` to `true` or `undefined` in the global configuration will reset the default values altogether.

### Automatic scrolling

During a touch drag, holding the finger near the edge of a scrollable container or the viewport scrolls the content automatically. Scrolling becomes faster closer to the edge and continues even when the finger stays still. The nearest scrollable ancestor takes priority on each axis; an ancestor can take over when it reaches its limit.

Use `scrollSensitivity` to change the edge zone and `scrollSpeed` to change the maximum speed. Set `autoScroll: false` to disable it globally under `touch`, or locally on a draggable:

```js
dndDrag(foodEl, {
  type: "food",
  touch: { autoScroll: false },
});
```

The target under the finger stays updated while the content scrolls. Scrolling stops when the finger leaves the edge zone or the drag ends or is cancelled. These options apply to the synthetic touch engine; mouse dragging keeps the browser's native scrolling behavior.

### Local touch override

Touch behaviour can be configured on each individual draggable configuration with the `touch` prop. The same properties can be defined. They will get merged with the globally configured properties while considering additional rules defined above.

If local touch configuration is `undefined`, global configuration is used. When otherwise falsy, will prevent touch drag.

## Lifecycle

Binding elements implies attaching listeners on HTML elements. It is important to properly handle their lifecycle.

`dnd`, `dndDrag`, `dndDrop`, `draggable()`, `droppable()` and `dragDroppable()` all return a `destroy()` method. It should be called when the drag or drop functionalities are no longer needed (usually when unmounting a component).

### Lifecycle in Svelte

When used in Svelte, this lifecycle and DOM cleanup are generally handled automatically by Svelte.

When using the `use:` directive with `dnd`, `dndDrag`, or `dndDrop` and a configuration argument, the internally created controllers are destroyed when the bound element unmounts.

When a store is passed as an argument to `dnd`, `dndDrag`, or `dndDrop` however, unmounting the bound element will simply unbind it from the store, which can then be bound again later.

Svelte automatically unsubscribes from stores referenced with `$store`. Once the store is detached and no references remain, it can be garbage-collected without an explicit `destroy()` call.

## Limitations

- Keyboard interactions are not supported for the moment.

## Usage in Svelte (optional)

Although the library is framework-independant, it has been developed by a Svelte programmer.

Instead of getting a reference to an HTML element to pass as argument, elements can be targeted with the `use:` directive.

```svelte
<div use:dndDrag={{ type: "toy", data: { color: "red" } }}>Red Truck Toy</div>
```

The `draggable`, `droppable`, and `dragDroppable` stores conform to the [Svelte store contract](https://svelte.dev/docs/svelte/stores#Store-contract) and can be subscribed to with `$myDragStore` in Svelte.

```svelte
<script>
  import { dndDrop, droppable } from "drag-droppable";

  const dropStore = droppable({ type: "food" });

  const { canDrop, concerned } = $derived($dropStore);
</script>

<div class:dropzone={concerned} class:drop={canDrop} use:dndDrop={dropStore}>
  Baby Mouth
</div>
```

## Usage in React (optional)

React 18 and 19 applications can import hooks from `drag-droppable/react`. React is an optional peer dependency; using the core entry point does not require it.

Each hook returns `{ ref, state, controller }`. Attach `ref` to one HTML element. The hook manages binding, cleanup, configuration updates, and state subscriptions.

```jsx
import { useState } from "react";
import { useDraggable, useDroppable } from "drag-droppable/react";

export default function Dinner() {
  const [hunger, setHunger] = useState(6);
  const [spoonfuls, setSpoonfuls] = useState(4);

  const { ref: mealRef } = useDraggable({
    type: "food",
    data: { quality: 2 },
    disabled: spoonfuls <= 0,
  });

  const { ref: babyRef, state } = useDroppable({
    type: "food",
    data: { hunger },
    when: (_, { drop }) => drop.hunger > 0,
    onDrop: ({ dragged: meal }) => {
      setHunger((current) => Math.max(0, current - meal.quality));
      setSpoonfuls((current) => current - 1);
    },
  });

  return (
    <>
      <div ref={mealRef}>Dinner: {spoonfuls} spoonfuls left</div>
      <div ref={babyRef} className={state.canDrop ? "open-wide" : ""}>
        Mia: {hunger > 0 ? `Hunger: ${hunger}` : "Finally full."}
      </div>
    </>
  );
}
```

`state` exposes the same fields as the corresponding store and is read-only. It updates automatically; no manual `useSyncExternalStore` call is needed. React application data should be updated with React state setters, as above. Inline options, callbacks, and data objects are supported. The droppable hook reads its `state.drop` from the current options rather than subscribing to changes in the data it already receives from React.

By default, position changes can trigger renders. When CSS data attributes are enough, opt out of the subscription:

```jsx
const { ref } = useDroppable(options, { subscribe: false });
```

In this mode, `state` stays at its initial idle value, while drag-and-drop callbacks and data attributes still work. The setting can be changed at runtime.

Pass configuration through the hook options; `el` is replaced by `ref`. The returned `controller` provides access to `getSnapshot()` or manual subscriptions when needed. Do not destroy or bind it independently: the hook owns its DOM lifecycle. On detachment or unmount, the controller is unbound so it can survive Strict Mode's additional setup/cleanup cycle. Once unreferenced, it can be garbage-collected.

Server rendering uses an idle snapshot; DOM binding happens on the client. Hooks use the same generic convention as controllers: local data first, partner data second, for example `useDroppable<Baby, Food>(options)`.

## Usage in Vue (optional)

Vue 3.3+ applications can import composables from `drag-droppable/vue`. Vue is an optional peer dependency; the core entry point does not import it.

Call `useDraggable` and `useDroppable` in component setup. Each returns `{ ref, state, controller }`: a template ref, a shallow read-only state ref, and the underlying controller.

```vue
<script setup>
import { ref } from "vue";
import { useDraggable, useDroppable } from "drag-droppable/vue";

const hunger = ref(6);
const spoonfuls = ref(4);

const { ref: mealRef } = useDraggable(() => ({
  type: "food",
  data: { quality: 2 },
  disabled: spoonfuls.value <= 0,
}));

const { ref: babyRef, state: dropState } = useDroppable(() => ({
  type: "food",
  data: { hunger: hunger.value },
  when: (_, { drop }) => drop.hunger > 0,
  onDrop: ({ dragged: food }) => {
    hunger.value = Math.max(0, hunger.value - food.quality);
    spoonfuls.value -= 1;
  },
}));
</script>

<template>
  <div ref="mealRef">Dinner: {{ spoonfuls }} spoonfuls left</div>
  <div ref="babyRef" :class="{ 'open-wide': dropState.canDrop }">
    Mia: hunger {{ hunger }}
  </div>
</template>
```

Pass a getter for reactive configuration: values read by the getter are tracked and changes are forwarded to `update()`. A plain options object or a ref containing options is also accepted. Changes inside an arbitrary non-reactive object are not tracked; use reactive values in the getter for dynamic options.

In scripts, read state with `dropState.value.canDrop`; Vue unwraps refs automatically in templates. The state ref does not deeply proxy or freeze the snapshot, so payloads retain their original references. Treat state fields as read-only and manage application data through Vue's reactivity.

Use `{ subscribe: false }` when data attributes and callbacks are enough:

```js
const { ref: babyRef } = useDroppable(() => options, { subscribe: false });
```

Without a subscription, the state ref stays at its initial idle value. Settings may also be reactive or supplied through a ref or getter, allowing the subscription to be toggled.

Binding follows the template ref, including conditional elements and replacements. The composable applies options and subscribes on mount, then stops its watchers, unsubscribes, and destroys its controller before unmount. Server rendering exposes idle state without binding elements. Configure through the composable options and use its template ref instead of `el`; do not bind or destroy the controller independently.

Type parameters follow the same convention as the core and React APIs: local data first, partner data second, for example `useDroppable<Baby, Food>(() => options)`.

## Examples

### Drag position

> Who gets fed first?

Use `top` and `bottom` to show an insertion line, then use `bottom` in `onDrop` to insert before or after the target. The library reports the position; the app code changes the order.

In this Svelte example, each row owns a combined store so it can be moved and read the current drop position.

```svelte
<!-- QueueBaby.svelte -->
<script>
  import { dnd, dragDroppable } from "drag-droppable";

  let { baby, onMove } = $props();
  const babyStore = dragDroppable();

  $effect(() => {
    babyStore.update({
      type: "baby",
      data: baby,
      unless: (dragged) => dragged === baby,
      onDrop: onMove,
    });
  });
</script>

<div
  use:dnd={babyStore}
  class:before={$babyStore.canDrop && $babyStore.top}
  class:after={$babyStore.canDrop && $babyStore.bottom}
>
  {baby}
</div>

<style>
  div {
    padding: 1rem;
  }
  .before {
    box-shadow: inset 0 2px #0e7490;
  }
  .after {
    box-shadow: inset 0 -2px #0e7490;
  }
</style>
```

The parent updates the list, keeping each baby in a keyed row:

```svelte
<!-- Queue.svelte -->
<script>
  import QueueBaby from "./QueueBaby.svelte";

  let babies = $state(["Mia", "Leo", "Zoe"]);

  function moveBaby({ bottom, dragged, drop }) {
    const next = babies.filter((baby) => baby !== dragged);
    const index = next.indexOf(drop);
    next.splice(index + (bottom ? 1 : 0), 0, dragged);
    babies = next;
  }
</script>

{#each babies as baby (baby)}
  <QueueBaby {baby} onMove={moveBaby} />
{/each}
```

### Using namespaces

> Different nurseries, same toys

Both nurseries accept `"toy"`, but a matching namespace is also required. The upstairs duck stays upstairs. It has a very strict contract.

```js
import { dndDrag, dndDrop } from "drag-droppable";

for (const nursery of ["upstairs", "downstairs"]) {
  dndDrag(toyEls[nursery], {
    namespace: nursery,
    type: "toy",
    data: { name: "Squeaky duck" },
  });

  dndDrop(basketEls[nursery], {
    namespace: nursery,
    type: "toy",
    onDrop: ({ dragged: toy }) => putAway(nursery, toy),
  });
}
```

Omitting the namespace uses the common default group; it does not match every namespace. Outside Svelte actions, retain the returned `destroy()` functions for cleanup as described in [Lifecycle](#lifecycle).

### Data-driven decisions

> The two sides of the spoon

The dragged data describes the food; the drop data describes the babies. The callback can use both to decide how much is served to which baby.

```js
import { dndDrag, dndDrop } from "drag-droppable";

const babyByName = Object.fromEntries(
  [
    { el: miaEl, name: "Mia", hunger: 6 },
    { el: leoEl, name: "Leo", hunger: 3 },
  ].map(({ el, ...data }) => {
    const drop = dndDrop(el, {
      data,
      type: "food",
      when: (_, { drop: { hunger } }) => hunger > 0,
      onDrop: feedBaby,
    });
    return [data.name, drop];
  }),
);

const mealsByName = Object.fromEntries(
  [
    { el: goodMealEl, name: "good", quality: 2, spoonfuls: 4 },
    { el: badMealEl, name: "bad", quality: 1, spoonfuls: 10 },
  ].map(({ el, ...data }) => {
    const drag = dndDrag(el, {
      data,
      type: "food",
      disabled: !data?.spoonfuls,
    });
    return [data.name, drag];
  }),
);

/* Both `dragged` and `drop` data are used in the `onDrop` callback.
 * Note that callback could have been placed on either `dndDrag` or `dndDrop`. */
function feedBaby({
  /* `draggedData` gives information about food quality */
  dragged: { name: mealName, quality = 0 },
  /* `drop` data gives information to retrieve store */
  drop: { name: babyName },
}) {
  const meal = mealsByName[mealName];
  if (meal) {
    meal.update(({ data: { spoonfuls, ...restData } = {}, ...rest }) => ({
      ...rest,
      data: { ...restData, spoonfuls: spoonfuls - 1 },
      disabled: spoonfuls - 1 <= 0,
    }));
  }

  const baby = babyByName[babyName];
  if (baby) {
    baby.update(({ data, ...rest }) => ({
      ...rest,
      data: { ...data, hunger: data.hunger - quality },
    }));
  }
}
```

`feedBaby` belongs to your application; the library doesn't impose any special way to manage interactions. It just provides the infrastructure to simplify data sharing.

With Svelte, the same example can use reactive data directly. No controller lookup is needed: `dragged` and `drop` refer to the meal and baby objects from `$state`.

```svelte
<script>
  import { dndDrag, dndDrop } from "drag-droppable";

  let babies = $state([
    { name: "Mia", hunger: 6 },
    { name: "Leo", hunger: 3 },
  ]);
  let meals = $state([
    { name: "good", quality: 2, spoonfuls: 4 },
    { name: "bad", quality: 1, spoonfuls: 10 },
  ]);

  function feedBaby({ dragged: meal, drop: baby }) {
    meal.spoonfuls -= 1;
    baby.hunger = Math.max(0, baby.hunger - meal.quality);
  }
</script>

{#each meals as meal (meal.name)}
  <div
    use:dndDrag={{
      type: "food",
      data: meal,
      disabled: meal.spoonfuls <= 0,
    }}
  >
    {meal.name} food: {meal.spoonfuls} spoonfuls left
  </div>
{/each}

{#each babies as baby (baby.name)}
  <div
    use:dndDrop={{
      type: "food",
      data: baby,
      when: (_, { drop }) => drop.hunger > 0,
      onDrop: feedBaby,
    }}
  >
    {baby.name}: {baby.hunger > 0
      ? `Hunger: ${baby.hunger}`
      : "Full. Ask again in five minutes."}
  </div>
{/each}
```

Svelte reacts to these mutations, updates the displayed values, and passes updated options to the actions. An empty meal becomes disabled automatically. The application changes the data; the library still only passes it along.

### Target and handle

> Move the plate, aim for the mouth

`handle` chooses where a drag can start, `except` protects an interactive control inside that handle, and `target` limits where a drop can land. Dropping dinner on the baby's forehead does not count.

```svelte
<script>
  import { dndDrag, dndDrop } from "drag-droppable";

  let tastings = $state(0);
  let lastMeal = $state("Nothing yet");
</script>

<article
  use:dndDrag={{
    type: "food",
    data: { name: "Pea puree" },
    handle: ".handle",
    except: "button",
  }}
>
  <span class="handle">
    Move plate
    <button type="button" onclick={() => tastings++}>Taste first</button>
  </span>
  <p>Pea puree. Tastings: {tastings}.</p>
</article>

<article
  use:dndDrop={{
    type: "food",
    target: ".mouth",
    onDrop: ({ dragged: food }) => (lastMeal = food.name),
  }}
>
  <h3>Mia</h3>
  <div class="mouth">Feed here</div>
  <p>Last meal: {lastMeal}</p>
</article>

<style>
  .handle {
    cursor: grab;
  }
  .mouth {
    padding: 1rem;
    border: 1px dashed gray;
  }
</style>
```

The whole plate is used as the drag image by default, even though only its handle starts the drag. Drop positions are measured relative to the mouth, while the store and data attributes remain attached to the article.

## TypeScript

Type declarations are included; no Svelte dependency is required. Data types are inferred from the `data` option. When callbacks need both sides typed, specify the local data type first and the other side's type second:

```ts
import { droppable } from "drag-droppable";

type Baby = { name: string; hunger: number };
type Food = { name: string; quality: number };

const baby = droppable<Baby, Food>({
  type: "food",
  data: { name: "Mia", hunger: 6 },
  when: (food, { drop }) => drop.hunger > 0 && food.quality > 0,
  onDrop: ({ dragged: food, drop }) => {
    drop.hunger = Math.max(0, drop.hunger - food.quality);
  },
});
```

The same convention applies to `draggable`, `dndDrag`, and `dndDrop`. For `dragDroppable` and `dnd`, the first type describes this element's data shared by both roles; the second describes incoming dragged data. For example, given a `babyEl` element:

```ts
import { dnd, dragDroppable } from "drag-droppable";

const movingBaby = dragDroppable<Baby, Food>({
  type: "baby",
  types: ["food"],
  data: { name: "Mia", hunger: 6 },
  onDrop: ({ dragged: food, drop: baby }) => {
    baby.hunger = Math.max(0, baby.hunger - food.quality);
  },
});

const binding = dnd(babyEl, movingBaby);
movingBaby.getSnapshot().dragging; // This baby is being dragged.
movingBaby.getSnapshot().dragged?.quality; // Incoming Food data.
```

`DragDroppableOptions`, `DragDroppableState`, and `DragDroppableController` describe the combined API. `DnDOptions` remains available for the same flat configuration. Unspecified data types default to `unknown`. Types cannot enforce that independently configured drag sources and drop targets carry matching data; keep their `type` and `namespace` contracts consistent.
