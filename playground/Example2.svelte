<script module>
  import { configureDnD, dndDrag, dndDrop } from "../src";
</script>

<script>
  let globalTouchEnabled = $state(true);
  let localTouchEnabled = $state(true);

  $effect(() => {
    configureDnD({ touch: globalTouchEnabled });
  });

  const dragExamples = $derived([
    {
      data: 43,
      type: "foo",
      touch: undefined,
    },
    {
      disabled: true,
      type: "bar",
      touch: true,
    },
    {
      namespace: "david",
      type: "baz",
      touch: localTouchEnabled,
    },
  ]);

  const dropExamples = [
    {
      disabled: true,
      types: ["foo"],
    },
    {
      types: ["bar"],
    },
    {
      namespace: "david",
      types: ["foo", "bar", "baz"],
      // unless: { foo: (data) => data !== 42 },
    },
  ];
</script>

<div>
  <button
    type="button"
    onclick={() =>
      (globalTouchEnabled = globalTouchEnabled
        ? null
        : globalTouchEnabled === null
          ? false
          : true)}
  >
    Touch GLOBAL : {globalTouchEnabled
      ? "Activé"
      : globalTouchEnabled === null
        ? "Sur demande"
        : "Désactivé"}
  </button>

  <button
    type="button"
    onclick={() => (localTouchEnabled = !localTouchEnabled)}
  >
    Touch local : {localTouchEnabled ? "Activé" : "Désactivé"}
  </button>
</div>

<section>
  <div>
    {#each dragExamples as drag (drag.name || drag.type)}
      <div class="draggable" use:dndDrag={drag}>
        <pre><code>{JSON.stringify(drag, null, 2)}</code></pre>
      </div>
    {/each}
  </div>

  <div>
    {#each dropExamples as drop (drop.name || drop.types.join("+"))}
      <div class="droppable" use:dndDrop={drop}>
        {JSON.stringify(drop, null, 2)}
      </div>
    {/each}
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 0 1rem;
    grid-template-columns: repeat(2, 1fr);
  }

  section > div {
    padding: 0.5rem 1rem;
  }
</style>
