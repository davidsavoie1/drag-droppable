# Drag-droppable

Lightweight, data-driven, framework-independent drag-and-drop system with touch support and reactive stores.

The library doesn't include any styling, only data that can be used to apply styles. Keyboard interactions are not supported for the moment.

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

## `onDrop`

An `onDrop` callback will be called when a drop successfully occurs, either from the perspective of:

- the dragged then dropped element (draggable);
- the element that received the dropped element (droppable).

In both cases, the function receives the same arguments:

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
    left, // Dropped more on the left.
    right, // Dropped more on the right.
    top, // Dropped more on top.
    bottom, // Dropped more on bottom.
  }) => {},
);
```

## Usage in Svelte (optional)

Although the library is framework-independant, it has been developed by a Svelte programmer.

Instead of getting a reference to an HTML element to pass as argument, elements can be targeted with the `use:` directive.

```svelte
<div use:dndDrag={{ type: "toy", data: { color: "red" } }}>Red Truck Toy</div>
```

The `draggable` and `droppable` stores conform to the [Svelte store contract](https://svelte.dev/docs/svelte/stores#Store-contract) and can be subscribed to with `$myDragStore` in Svelte.

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

The same convention applies to `draggable`, `dndDrag` and `dndDrop`. Unspecified data types default to `unknown`. Types cannot enforce that independently configured drag sources and drop targets carry matching data; keep their `type` and `namespace` contracts consistent.

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

For matching types and namespaces, acceptance is evaluated when the drag is announced to the droppable, near the start of the drag. The predicates are not continuously re-evaluated during hover or checked again at drop time. Changing the referenced data alone does not refresh acceptance for the current drag.

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

### Returns

**`destroy()`**: A function to destroy the droppable functionalities and remove handlers.

**`update(configOrFunction)`**: Replace the droppable configuration, directly or through an updater function. See [Dynamic configuration](#dynamic-configuration).

## Stores

A store can be created separately, then passed to `dndDrag`/`dndDrop` or manually bound to an HTML element.

Both stores expose similar methods:

- **`bind(element)`**: Bind to an HTML element. Rebinding to the same element is allowed, but switching to a different element requires `unbind()` first.

- **`unbind()`**: Detach from the currently bound element without destroying the store.

- **`update(configOrFunction)`**: Replace the whole configuration. An updater function receives a shallow copy of the current configuration and returns its replacement. Passing or returning a falsy value resets the configuration to `{ disabled: true }`. See [Dynamic configuration](#dynamic-configuration).

- **`subscribe(cb)`**: Register a callback to receive updates on store internal state. Returned state differs between draggable and droppable (see example below). `droppable` store subscription includes positionning of dragged element. See [`onDrop`](#ondrop) for details.

- **`destroy()`**: Fully tear down the store.

```js
import { dndDrag, dndDrop, draggable, droppable } from "drag-droppable";

const dragStore = draggable({/* dndDrag second argument */});
dndDrag(dragHTMLElement, dragStore);

dragStore.subscribe(
  ({
    dragging, // Is drag in process?
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
    dragging, // Is drag in process?
    drop, // Drop data.
    type, // Dragged element type.
    unconcerned, // Drag of interest, but refused by `unless` and `when` predicates.

    ...positionning // See `onDrop` documentation
  }) => {
    /* Do something with this information */
  },
);
```

## Dynamic configuration

The argument used for initial configuration might change at runtime. For example, having a `disabled` draggable can be useful, but it probably should be based on a condition that could change.

`dndDrag` and `dndDrop` both return an `update()` function. The `draggable` and `droppable` stores expose the same method.

An object argument replaces the entire configuration; omitted options are not preserved. An updater function receives a shallow copy of the current configuration and must return the replacement. Spread the current configuration to retain options you do not want to change.

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

The copy passed to the updater is shallow: nested objects, including `data`, still share their original references. Passing or returning a falsy value resets the configuration to `{ disabled: true }`; it does not preserve options for later reactivation.

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

The prefix used in the data attributes can be configured with `configureDnD`.

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  attributesPrefix: "dd",
});
```

## Touch

Touch devices need a special treatment for drag-and-drop to work correctly. The native drag-and-drop API doesn't apply to touch, so the library implements synthetic drag and drop events for a unified experience.

To prevent unwanted behaviour such as initating a drag when scrolling content for example, some parameters are checked to consider a drag. They can be configured with `configureDnD`, under the `touch` key.

```js
import { configureDnD } from "drag-droppable";

configureDnD({
  touch: {
    /* Default values */
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

### Local touch override

Touch behaviour can be configured on each individual draggable configuration with the `touch` prop. The same properties can be defined. They will get merged with the globally configured properties while considering additional rules defined above.

If local touch configuration is `undefined`, global configuration is used. When otherwise falsy, will prevent touch drag.

## Lifecycle

Binding elements implies attaching listeners on HTML elements. It is important to properly handle their lifecycle.

`dndDrag`, `dndDrop`, `draggable()` and `droppable()` both return a `destroy()` method. It should be called when the drag or drop functionalities are no longer needed (usually when unmounting a component).

### Lifecycle in Svelte

When used in Svelte, this lifecycle and DOM cleanup are generally handled automatically by Svelte.

When using the `use:` directive with `dndDrag` or `dndDrop` and a configuration argument, the store created internally will get destroyed when the bound element unmounts.

When a store is passed as an argument to these functions however, unmounting the bound element will simply unbind it from the store, which can then be bound again later.

Svelte automatically unsubscribes from stores referenced with `$store`. Once the store is detached and no references remain, it can be garbage-collected without an explicit `destroy()` call.

## Examples

### Drag position

> Who gets fed first?

Use `top` and `bottom` to show an insertion line, then use `bottom` in `onDrop` to insert before or after the target. The library reports the position; the app code changes the order.

In this Svelte example, each row owns a drop store so it can read the current position.

```svelte
<!-- QueueBaby.svelte -->
<script>
  import { dndDrag, dndDrop, droppable } from "drag-droppable";

  let { baby, onMove } = $props();
  const dropStore = droppable();

  $effect(() => {
    dropStore.update({
      type: "baby",
      data: baby,
      unless: (dragged) => dragged === baby,
      onDrop: onMove,
    });
  });
</script>

<div
  use:dndDrag={{ type: "baby", data: baby }}
  use:dndDrop={dropStore}
  class:before={$dropStore.canDrop && $dropStore.top}
  class:after={$dropStore.canDrop && $dropStore.bottom}
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
