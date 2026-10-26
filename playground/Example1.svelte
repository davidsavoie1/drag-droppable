<script module>
  import { dndDrag, dndDrop } from "../src";
</script>

<script>
  const dragExamples = $derived([
    {
      name: "salty",
      type: "food",
      data: { tastes: ["salty"], texture: "solid" },
    },

    {
      name: "tart",
      type: "food",
      data: { tastes: ["salty", "tart"], texture: "solid" },
    },

    {
      name: "toy",
      type: "toy",
    },
  ]);

  const dropExamples = [
    {
      name: "mouth",
      types: ["food"],
      when: ({ drag: food }) => food.texture === "solid",
      unless: ({ drag: food }) => food.tastes?.includes("tart"),
    },
  ];
</script>

<!-- <div>
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

  <button type="button" onclick={() => (dragEnabled = !dragEnabled)}>
    Drag : {dragEnabled ? "Activé" : "Désactivé"}
  </button>
</div> -->

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
