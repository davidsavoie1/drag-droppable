# Drag-droppable

Lightweight, data-driven, framework-independent drag-and-drop system with touch support.

Attach data to draggable and droppable elements and use it to handle the drops. Drop targets react only to relevant drags based on namespace, type and respective data.

**You decide how to represent the drag-and-drop interactions**... with a lot of information to do so! The library doesn't include any built-in styling that would get in the way (it would, it always does).

**You decide how to handle drops**... with a lot of information to do so! No HTML mutation will actually move anything around permanently, preventing inconsistencies with the actual state of your app (it would, it always does).

**You choose your favorite framework**. Although the library has been developped with Svelte in mind, it will work fine in React, Vue and even plain old Javascript. Optional React hooks and Vue composables are even provided!

**You can use it with touch support out of the box** without any adapter or workaround... and you can configure it as you like.

The core has no dependencies, only a few kB of modern Javascript. Optional React hooks and Vue composables use your application's framework installation.

## Table of contents

- [Table of contents](#table-of-contents)
- [Typical usage](#typical-usage)
- [Data shape](#data-shape)
- [Drag: `dndDrag`](#drag-dnddrag)
- [Drop: `dndDrop`](#drop-dnddrop)
- [Drag and drop: `dnd`](#drag-and-drop-dnd)
- [Sorting: `createSortable`](#sorting-createsortable)
- [Observing changes](#observing-changes)
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
- [Advanced: stores and custom integrations](#advanced-stores-and-custom-integrations)

## Typical usage

The following example showcases a baby (a drop target element) and a variety of things it could bring to its mouth (dragged elements). Data involved in the process allow deciding what can go in the mouth or not. Styling these interactions is left to the app code. No HTML mutation will actually move anything around permanently.

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

  /* Drop can be accepted conditionally based on dragged element */
  when: ({ drag: food }) => food.tastes.includes("sweet"),
  unless: ({ drag: food }) => food.texture === "solid",

  /* Do something after drop */
  onDrop({ drag: food }) {
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

## Data shape

The same data shape is used to allow (`when`), deny (`unless`) or react to a drop (`onDrop`):

```js
onDrop(
  ({
    drag, // Dragged data.
    drop, // Drop data.
    namespace, // Namespace of drag-and-drop.
    type, // Dragged element type.

    /* Position */
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

An `onDrop` callback will be called when a drop successfully occurs, either from the perspective of:

- the dragged then dropped element (draggable);
- the element that received the dropped element (droppable).

In both cases, the function receives the same arguments. With the combined `dnd` binding, `onDrop` belongs only to the target.

## Drag: `dndDrag`

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
  onChange,
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

**`namespace`**: Only draggable and droppable in the same namespace can interact with each other. `null` and `undefined` namespace is treated as `""`. Optional.

**`type`**: Type of draggable element. Only droppables that include it in their `types` will react to it.

**`data`**: Data the dragged element carries with it. Available as `drag` in the single argument of `unless`, `when`, and `onDrop`, and in the target state reported by `onChange`.

**`disabled`**: Disabled draggable element cannot be dragged.

### Handling

**`onChange(state)`**: React to changes in `dragging` and `pointerType`. See [Observing changes](#observing-changes).

**`onDrag(data, type, namespace)`**: Function to execute when a drag is initiated.

**`onDragEnd(data, type, namespace)`**: Function to execute when a drag ends, whether it resulted in a successful drop or was cancelled. Receives the data, type and namespace captured when the drag started. Use `onDrop` for successful drops and `onDragEnd` for end-of-drag cleanup.

**`onDrop({ ...onDropArgs })`**: Function to execute when dragged element is dropped. See [Data shape](#data-shape).

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

## Drop: `dndDrop`

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
  onChange,
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

**`namespace`**: Only draggable and droppable in the same namespace can interact with each other. `null` and `undefined` namespace is treated as `""`. Optional.

**`types`**: Types of draggable elements accepted by the droppable.

**`type`**: Shorthand when accepting a single type.

**`data`**: Data associated with the drop element. Available as `drop` in the single argument of `when` and `unless`, in the `onDrop` callback argument, and in the state reported by `onChange`.

**`disabled`**: Disabled droppable element cannot accept drops.

### Handling

**`onDrop({ ...onDropArgs })`**: Function to execute when dragged element is dropped. See [Data shape](#data-shape).

**`onChange(state)`**: React to changes in `accepts`, `concerned`, and drop position. See [Observing changes](#observing-changes).

**`unless({ drag, drop, type, namespace, ...position })`**: Predicate function that prevents drop when true.

**`when({ drag, drop, type, namespace, ...position })`**: Predicate function that allows drop only when true.

Both receive one object containing `{ drag, drop, type, namespace, ...position }`. Position fields (`x`, `y`, `dx`, `dy`, `left`, `right`, `top`, `bottom`) are available during hover and drop when the target has a usable rectangle. For example:

```js
when: ({ drag: food, drop: baby }) =>
  baby.hunger > 0 && food.texture === "smooth";
```

For matching types and namespaces, these conditions are checked when a drag starts and when a target is added or its options change. As you move over targets, only the hovered target is checked again, including targets that previously refused the drag. Conditions are checked once more before a drop. Position fields are absent outside hover and drop checks, so allow for missing values if your conditions use them.

Each of them can also be defined as an object with a different handler for each type.

```js
import { dndDrop } from "drag-droppable";

dndDrop(HTMLElement, {
  types: ["food", "toy"],
  when: {
    food: ({ drag: food }) => food.texture === "smooth",
    toy: ({ drag: toy }) => toy.size < 42,
  },
  onDrop: {
    food: ({ drag }) => eatFood(drag),
    toy: spitOut, // Receives complete dnd data, including position
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

## Drag and drop: `dnd`

Use `dnd(element, options)` when the same element is both a drag source and a drop target for the same namespace and type. It also works as a Svelte action:

```svelte
<script>
  import { dnd } from "drag-droppable";
</script>

<div
  use:dnd={{
    type: "baby",
    data: { name: "Mia" },
    onDrop: ({ drag, drop }) => console.log(drag, "visits", drop),
  }}
>
  Baby Mia
</div>
```

The flat configuration combines draggable and droppable options. `data`, `namespace`, `disabled`, and `attributesPrefix` apply to both roles. `type` defines the emitted type and, by default, the accepted type. Set `types` to override accepted types independently: `{ type: "baby", types: ["baby", "toy"] }` emits `"baby"` and accepts `"baby"` or `"toy"`.

**`onDrop` handles drops only**, including callbacks defined by type. `onDrag` and `onDragEnd` keep their usual source behavior.

`dnd` rejects drops onto the same element by default. Set `allowSelfDrop: true` to permit them.

`dnd` returns `update()` and `destroy()`, like `dndDrag` and `dndDrop`. `disabled` disables both roles. Its `onChange` callback reports both roles together: `dragging` describes this element being dragged, while `accepts` and position describe a drag over this element.

For different data or namespaces for each role, or a source-side `onDrop`, use `dndDrag` and `dndDrop` separately.

## Sorting: `createSortable`

Drag and drop is often used to sort vertical or horizontal lists. `createSortable` is a factory that creates a `sortable` controller that can be used just as `dnd`, but that greatly **simplifies list reordering**.

**`sortable` must be provided with the `index`** of the element in the list.

```svelte
<script>
  import { createSortable } from "drag-droppable";

  let babies = $state([
    { _id: "baby1", name: "Mia" },
    { _id: "baby2", name: "Leo" },
    { _id: "baby3", name: "Zoe" },
  ]);

  const sortable = createSortable({
    dataToId: "_id",
    onListChange: (list) => (babies = [...list]),
  });
</script>

<div class="list">
  {#each babies as baby, index (baby)}
    <div class="baby" use:sortable={{ data: baby, index, type: "baby" }}>
      {baby.name}
    </div>
  {/each}
</div>
```

`createSortable` accepts these arguments:

- `allowExternal`: Allow insertion from another list or an ordinary draggable. Default: `false`.
- `dataToId`: A way to extract a unique identifier from the element data. Either a function `(data) => id`, a string representing a prop on an object or an integer representing an array index. When not provided, data itself is used as identity.
- `horizontal`: When true, list is considered horizontal; `left` and `right` properties are used to determine `before` and `after`, respectively. Otherwise, list is vertical and `top` and `bottom` are used instead.
- `noAfter`|`noBefore`|`noSwap`: When true, prevent drops at these positions. Default: `false`.
- `noReorder`: Prevent moves and swaps within this list. External insertions still follow `allowExternal`. Default: `false`.
- `onListChange(data, context)`: Receives the proposed list and drop context (`drag`, `drop`, position, `ids`, `external`, and `dragIndex`). Apply the change in your application; `external` identifies a source outside this list, and `dragIndex` is available when it comes from a sortable.

Drops are prevented when position would not generate any change (ie dropping an element on the `before` position of the next element).

When dropzone thresholds less than 0.5 are defined on `sortable` (`bottomTopThreshold` for vertical list, `leftRightThreshold` for horizontal), a middle zone is created. A drop on it will be treated as an element swap instead of an insertion.

### Adding external elements

A `sortable` element configured with `allowExternal` can accept drag elements that are external to its own list, even elements that are not themselves `sortable` (ie a compatible draggable element).

This example moves a baby from a waiting list into a sortable list. Drop before or after an existing baby.

```svelte
<script>
  import { createSortable, dndDrag } from "drag-droppable";

  let waiting = $state([{ _id: "leo", name: "Leo" }]);
  let babies = $state([{ _id: "mia", name: "Mia" }]);

  const sortable = createSortable({
    dataToId: "_id",
    allowExternal: true,
    onListChange(list, { drag, external }) {
      babies = [...list];
      if (external) {
        waiting = waiting.filter((baby) => baby._id !== drag._id);
      }
    },
  });
</script>

<h3>Waiting</h3>
{#each waiting as baby (baby._id)}
  <div use:dndDrag={{ type: "baby", data: baby }}>{baby.name}</div>
{/each}

<h3>Nursery</h3>
{#each babies as baby, index (baby._id)}
  <div use:sortable={{ type: "baby", data: baby, index }}>{baby.name}</div>
{/each}
```

To copy instead of move, keep the source item in `waiting` by removing the `if (external)` block. Ids must remain unique within the destination list.

## Observing changes

Use `onChange` to update your interface as a drag progresses. You can also style elements with [data attributes](#data-attributes), without a callback.

```svelte
<script>
  import { dndDrop } from "drag-droppable";

  let drop = $state({});
</script>

<div
  use:dndDrop={{ type: "food", onChange: (state) => (drop = state) }}
  class:highlight={drop.accepts}
>
  Drop food here
</div>
```

The callback runs immediately when added, then whenever the state changes. Replacing the callback does not call it again unless the state also changes, so functions written directly in the options work fine. Removing and later adding `onChange` triggers a new immediate call.

| State field                                            | Meaning                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `dragging`                                             | For `dndDrag` and `dnd`, this element is being dragged. For `dndDrop`, a matching drag is in progress. |
| `pointerType`                                          | The source pointer type, such as `"mouse"` or `"touch"`, when available.                               |
| `concerned`                                            | The target accepts the current drag's type, namespace, and conditions.                                 |
| `unconcerned`                                          | Type and namespace match, but conditions prevent a drop.                                               |
| `accepts`                                              | The drag is over this target and a drop is allowed.                                                    |
| `drag`, `drop`, `type`, `namespace`                    | Data and identity of the current drag and target.                                                      |
| `x`, `y`, `dx`, `dy`, `left`, `right`, `top`, `bottom` | Position over the target; see [Data shape](#data-shape).                                               |

Source state contains `dragging` and `pointerType`; target state contains the acceptance, data, and position fields. `dnd` combines them. Target position clears on leave or drop, and drag state resets when the drag ends or the element is detached. Treat the received state as read-only.

React and Vue provide reactive `state` directly through their hooks and composables. They also accept `onChange` if you prefer a callback.

## Dynamic configuration

The argument used for initial configuration might change at runtime. For example, having a `disabled` draggable can be useful, but it probably should be based on a condition that could change.

`dnd`, `dndDrag`, and `dndDrop` return an `update()` method.

An object argument replaces the entire configuration; omitted options are not preserved.

An updater function receives a shallow copy of the current configuration and must return the replacement. Spread the current configuration to retain options you do not want to change. Nested objects such as `data` are shared, so copy them too if you want to change them without changing the original.

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

In Svelte, pass reactive options to `use:` and configuration updates automatically:

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

Targets added or re-enabled during a drag can participate immediately. Updating options keeps the hover position while the same target still accepts the drag. Changing the target element or refusing the drag clears its hover state; hover the target again before dropping.

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

These defaults apply to droppables unless they specify a [local override](#drop-dnddrop). Thresholds only affect the `left`, `right`, `top`, and `bottom` flags and their data attributes. Drops can still be accepted in the neutral center.

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
- `data-dnd-accepts`: Present when dragged element is relevant and is over droppable element
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
[data-dnd-droppable][data-dnd-accepts] {
  background-color: #67e8f9;
}

/* Droppable element could have been concerned, but refuses it at runtime. */
[data-dnd-droppable][data-dnd-unconcerned] {
  outline: solid 1px red;
}
```

In Svelte component styles, wrap the attribute selector in `:global()` and combine it with a local class:

```CSS
.item:global([data-dnd-draggable]) {
  /* Some CSS rules */
}
```

The prefix can be changed globally or overridden on individual elements. See [Global configuration](#global-configuration).

## Touch

Touch dragging works out of the box. By default, hold briefly before moving an element; this helps distinguish dragging from scrolling. Adjust the delay, movement tolerance, and other settings with `configureDnD`:

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  touch: {
    /* Default values */
    autoScroll: true, // Scroll near the edges during touch drags.
    scrollSensitivity: 40, // Edge activation zone, in pixels.
    scrollSpeed: 1000, // Maximum scroll speed, in pixels per second.
    dragImageOpacity: 0.5, // Opacity of the image created to follow the touch.
    lift: true, // Visual cue when touch dragging starts.
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

The target under the finger stays updated while the content scrolls. Scrolling stops when the finger leaves the edge zone or the drag ends or is cancelled. These scrolling options apply to touch dragging. Mouse scrolling follows the browser's usual behavior.

### Local touch override

Set `touch` on an individual draggable to override the global touch settings for that element. You can use the same options shown above.

Omit `touch` or set it to `undefined` to use global settings. Set it to `false` or `null` to disable touch dragging on that element.

## Lifecycle

In JavaScript, call the returned `destroy()` when an element no longer needs drag-and-drop behavior:

```js
const binding = dndDrop(element, { type: "food" });

// When removing the element:
binding.destroy();
```

Svelte actions, React hooks, and Vue composables handle cleanup automatically. See [Advanced: stores and custom integrations](#advanced-stores-and-custom-integrations) if you manage controllers yourself.

## Limitations

- Keyboard interactions are not supported for the moment.

## Usage in Svelte (optional)

Although the library is framework-independant, it has been developed by a Svelte programmer.

Instead of getting a reference to an HTML element to pass as argument, elements can be targeted with the `use:` directive.

```svelte
<div use:dndDrag={{ type: "toy", data: { color: "red" } }}>Red Truck Toy</div>
```

Pass reactive options directly to the action. Use `onChange` when the template needs drag state, as shown in [Observing changes](#observing-changes). Svelte handles option updates and cleanup.

## Usage in React (optional)

React 18 and 19 applications can import hooks from `drag-droppable/react`. React is an optional peer dependency; using the core entry point does not require it.

Each hook returns `ref` and `state`. Attach `ref` to one HTML element; `state` updates as you drag. Options and cleanup are handled automatically. An advanced `controller` is also available; see [Stores and custom integrations](#advanced-stores-and-custom-integrations).

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
    when: ({ drop }) => drop.hunger > 0,
    onDrop: ({ drag: meal }) => {
      setHunger((current) => Math.max(0, current - meal.quality));
      setSpoonfuls((current) => current - 1);
    },
  });

  return (
    <>
      <div ref={mealRef}>Dinner: {spoonfuls} spoonfuls left</div>
      <div ref={babyRef} className={state.accepts ? "open-wide" : ""}>
        Mia: {hunger > 0 ? `Hunger: ${hunger}` : "Finally full."}
      </div>
    </>
  );
}
```

`state` contains the fields described in [Observing changes](#observing-changes). Read them to render your UI; use React state setters to change your application data. Options, callbacks, and data objects can be written directly in the hook call.

If you only need CSS attributes or callbacks, skip automatic state updates:

```jsx
const { ref } = useDroppable(options, { subscribe: false });
```

With `subscribe: false`, the returned `state` stays at its initial value. Data attributes and callbacks, including `onChange`, still work.

Pass options to the hook and use `ref` to attach the element. Server rendering starts with idle state; dragging becomes available in the browser.

For TypeScript, specify local data first and incoming data second, for example `useDroppable<Baby, Food>(options)`.

### Combined roles in React

`useDnD(options, settings)` combines dragging and dropping, with the same options as `dnd`. Its `state.dragging` describes this element being moved; `state.accepts` describes an incoming drag.

```jsx
const { ref, state } = useDnD({ type: "baby", data: baby, onDrop: visitBaby });
```

Import it from `drag-droppable/react`, like the other hooks.

### Sortable lists in React

Call `useCreateSortable` once in the list component, then `useSortable` in each keyed row component. Each item returns `ref`, `state`, and a managed `controller`, like the other hooks.

```jsx
import { useState } from "react";
import { useCreateSortable, useSortable } from "drag-droppable/react";

function BabyRow({ sortable, baby, index }) {
  const { ref, state } = useSortable(sortable, { type: "baby", data: baby, index });
  return <div ref={ref} className={state.accepts ? "highlight" : ""}>{baby.name}</div>;
}

export default function Nursery() {
  const [babies, setBabies] = useState([
    { _id: "mia", name: "Mia" },
    { _id: "leo", name: "Leo" },
  ]);
  const sortable = useCreateSortable({
    dataToId: "_id",
    onListChange: (list) => setBabies(list),
  });
  return babies.map((baby, index) => (
    <BabyRow key={baby._id} sortable={sortable} baby={baby} index={index} />
  ));
}
```

The list instance stays stable while rules and callbacks follow updated options. `dataToId` is fixed when the list is created. Item options, including `index`, update automatically. Use `{ subscribe: false }` as the third argument of `useSortable` if you only need data attributes and callbacks. External insertions use the same `allowExternal` and `onListChange(data, context)` options as [Sorting](#sorting-createsortable).

## Usage in Vue (optional)

Vue 3.3+ applications can import composables from `drag-droppable/vue`. Vue is an optional peer dependency; the core entry point does not import it.

Call `useDraggable` and `useDroppable` in component setup. Each returns an element `ref` and a reactive `state` ref. An advanced `controller` is also available; see [Stores and custom integrations](#advanced-stores-and-custom-integrations).

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
  when: ({ drop }) => drop.hunger > 0,
  onDrop: ({ drag: food }) => {
    hunger.value = Math.max(0, hunger.value - food.quality);
    spoonfuls.value -= 1;
  },
}));
</script>

<template>
  <div ref="mealRef">Dinner: {{ spoonfuls }} spoonfuls left</div>
  <div ref="babyRef" :class="{ 'open-wide': dropState.accepts }">
    Mia: hunger {{ hunger }}
  </div>
</template>
```

Use a getter (`() => ({ ... }))`) when options depend on reactive values. The composable updates the configuration whenever those values change. A plain options object or a ref containing options also works.

Read state as `dropState.value.accepts` in scripts or `dropState.accepts` in templates. Treat it as read-only and change application data through Vue's reactivity.

If you only need CSS attributes or callbacks, skip automatic state updates:

```js
const { ref: babyRef } = useDroppable(() => options, { subscribe: false });
```

The returned state then stays at its initial value, while callbacks, including `onChange`, and data attributes still work. You can change this setting reactively too.

The composable follows element changes and handles cleanup when the component unmounts. Pass configuration through its options and attach the element using its ref. Server rendering starts with idle state.

Type parameters follow the same convention as the core and React APIs: local data first, partner data second, for example `useDroppable<Baby, Food>(() => options)`.

### Combined roles in Vue

`useDnD(options, settings)` combines dragging and dropping, with the same options as `dnd`. Its `state.value.dragging` describes this element being moved; `state.value.accepts` describes an incoming drag.

```js
const { ref: babyRef, state } = useDnD(() => ({
  type: "baby", data: props.baby, onDrop: visitBaby,
}));
```

Import it from `drag-droppable/vue`, like the other composables.

### Sortable lists in Vue

Create a shared sortable in the parent and pass it to keyed row components:

```vue
<!-- Nursery.vue -->
<script setup>
import { ref } from "vue";
import { useCreateSortable } from "drag-droppable/vue";
import BabyRow from "./BabyRow.vue";

const babies = ref([
  { _id: "mia", name: "Mia" },
  { _id: "leo", name: "Leo" },
]);
const sortable = useCreateSortable({
  dataToId: "_id",
  onListChange: (list) => { babies.value = list; },
});
</script>

<template>
  <BabyRow v-for="(baby, index) in babies" :key="baby._id"
    :sortable="sortable" :baby="baby" :index="index" />
</template>
```

```vue
<!-- BabyRow.vue -->
<script setup>
import { useSortable } from "drag-droppable/vue";

const props = defineProps(["sortable", "baby", "index"]);
const { ref: babyRef, state } = useSortable(props.sortable, () => ({
  type: "baby", data: props.baby, index: props.index,
}));
</script>

<template>
  <div ref="babyRef" :class="{ highlight: state.accepts }">{{ baby.name }}</div>
</template>
```

Use a getter for reactive list settings, just as for item options. The list stays stable; `dataToId` is fixed at creation. Each row follows element changes and cleans up automatically. `useSortable` accepts `{ subscribe: false }` as its third argument. External insertions use the same [sorting options](#sorting-createsortable) as the core action.

## Examples

### Drag position

> Who gets fed first?

Use `top` and `bottom` to show an insertion line, then use `bottom` in `onDrop` to insert before or after the target. The library reports the position; the app code changes the order.

In this Svelte example, each row can be moved and uses `onChange` to show the current drop position.

```svelte
<!-- QueueBaby.svelte -->
<script>
  import { dnd } from "drag-droppable";

  let { baby, onMove } = $props();
  let position = $state({});
</script>

<div
  use:dnd={{
    type: "baby",
    data: baby,
    onDrop: onMove,
    onChange: (state) => (position = state),
  }}
  class:before={position.accepts && position.top}
  class:after={position.accepts && position.bottom}
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

  function moveBaby({ bottom, drag, drop }) {
    const next = babies.filter((baby) => baby !== drag);
    const index = next.indexOf(drop);
    next.splice(index + (bottom ? 1 : 0), 0, drag);
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
    onDrop: ({ drag: toy }) => putAway(nursery, toy),
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
      when: ({ drop: { hunger } }) => hunger > 0,
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

/* Both `drag` and `drop` data are used in the `onDrop` callback.
 * Note that callback could have been placed on either `dndDrag` or `dndDrop`. */
function feedBaby({
  /* `draggedData` gives information about food quality */
  drag: { name: mealName, quality = 0 },
  /* `drop` identifies which baby to update */
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

With Svelte, the same example can use reactive data directly. No controller lookup is needed: `drag` and `drop` refer to the meal and baby objects from `$state`.

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

  function feedBaby({ drag: meal, drop: baby }) {
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
      when: ({ drop }) => drop.hunger > 0,
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
    onDrop: ({ drag: food }) => (lastMeal = food.name),
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

The whole plate is used as the drag image by default, even though only its handle starts the drag. Drop positions are measured relative to the mouth, while data attributes remain attached to the article.

## TypeScript

Types are included. Data types are inferred from `data`. To type both sides of a drop, specify this element's data first and the other side's data second:

```ts
import { dndDrop } from "drag-droppable";

type Baby = { name: string; hunger: number };
type Food = { name: string; quality: number };

const baby = dndDrop<Baby, Food>(babyEl, {
  type: "food",
  data: { name: "Mia", hunger: 6 },
  when: ({ drag: food, drop }) => drop.hunger > 0 && food.quality > 0,
  onDrop: ({ drag: food, drop }) => {
    drop.hunger = Math.max(0, drop.hunger - food.quality);
  },
});
```

The same order applies to `dndDrag` and `dnd`. With `dnd`, the first type describes the data shared by both roles and the second describes incoming drag data. React and Vue use this convention too. Unspecified types default to `unknown`; keep types and namespaces consistent between sources and targets.

## Advanced: stores and custom integrations

For most applications, use the actions above with `onChange`, or the React and Vue integrations. Separate controllers are also available when you need manual subscriptions, a reusable controller, or an integration with another framework.

These controllers follow the Svelte store contract and can be created before attaching an element:

| Factory                  | Corresponding action |
| ------------------------ | -------------------- |
| `draggable(options)`     | `dndDrag`            |
| `droppable(options)`     | `dndDrop`            |
| `dragDroppable(options)` | `dnd`                |

### Controller methods

- `bind(element)`: Attach to one element. Call `unbind()` before moving to another.
- `unbind()`: Detach while keeping the controller available for reuse.
- `update(optionsOrFunction)`: Replace options, with the same rules as [Dynamic configuration](#dynamic-configuration).
- `subscribe(callback)`: Receive the current state immediately, then each change. Returns a function to stop receiving notifications.
- `getSnapshot()`: Read the current state without subscribing. Treat it as read-only; repeated reads return the same object until the state changes.
- `destroy()`: Detach and stop all subscriptions. The controller cannot be reused afterward.

Controllers also accept `onChange`, with the same behavior as the actions. State fields are described in [Observing changes](#observing-changes). Store and controller types are exported alongside the action types, including `DroppableController`, `DragDroppableController`, and `DragDroppableState`.

### Building an integration

An adapter can connect subscriptions to another framework's state and attach the controller when its element becomes available:

```js
import { droppable } from "drag-droppable";

const controller = droppable({ type: "food" });
const stop = controller.subscribe((state) => {
  // Copy the state into your framework's reactive state.
});

controller.bind(element);

// When options change:
controller.update({ type: "food", disabled: true });

// When the integration is no longer needed:
stop();
controller.destroy();
```

For an element that disappears temporarily, use `unbind()` and later `bind(nextElement)` instead of destroying the controller. React and Vue use these same controllers internally. Their returned `controller` allows advanced reads and subscriptions, but let the hook or composable manage its options, element, and cleanup.

### Using a store in Svelte

Declare a controller in the component script and read its state through Svelte's `$store` syntax:

```svelte
<script>
  import { dndDrop, droppable } from "drag-droppable";

  const drop = droppable({ type: "food" });
</script>

<div use:dndDrop={drop} class:highlight={$drop.accepts}>Drop food here</div>
```

When passing an existing controller to an action, update options through `controller.update()` and keep passing the same controller. The action detaches it when the element is removed, so it can be attached again later. Svelte handles `$store` subscriptions automatically. In JavaScript, the same pattern is available as `dndDrop(element, controller)` (or the corresponding source or combined action).
