<script module>
  import { createSortable, dndDrag } from "../src";
</script>

<script>
  const horizontal = false;

  let babies = $state({
    A: [
      { _id: "baby1", name: "Mia" },
      { _id: "baby2", name: "Leo" },
      { _id: "baby3", name: "Zoe" },
    ],

    B: [
      { _id: "baby4", name: "Clarence" },
      { _id: "baby5", name: "Evelyne" },
      { _id: "baby6", name: "Justine" },
    ],

    C: [
      { _id: "baby7", name: "Foo" },
      { _id: "baby8", name: "Bar" },
      { _id: "baby9", name: "Baz" },
    ],
  });
</script>

<div class="container">
  {@render renderBabiesList("A")}
  {@render renderBabiesList("B")}

  <div class="list" class:horizontal>
    <div class="header">C</div>

    {#each babies.C as baby (baby)}
      <div
        class="baby"
        use:dndDrag={{
          attributesPrefix: "foo",
          type: "baby",
          data: { ...baby, list: "C" },
        }}
      >
        {baby.name}
      </div>
    {/each}
  </div>
</div>

{#snippet renderBabiesList(which)}
  {const sortable = createSortable({
    attributesPrefix: "foo",
    bottomTopThreshold: 0.25,
    type: "baby",
    allowExternal: true,
    dataToId: "_id",
    horizontal,
    allowReorder: false,
    allowSwap: true,
    onListChange: (
      /** @type {{ _id: string, name: string, list: string }[]} */ list,
      { drag: { _id: draggedId, list: draggedFromList }, external },
    ) => {
      babies =
        external && draggedFromList && babies[draggedFromList]
          ? {
              ...babies,
              [which]: [...list],
              [draggedFromList]: babies[draggedFromList].filter(
                (baby) => baby._id !== draggedId,
              ),
            }
          : {
              ...babies,
              [which]: [...list],
            };
    },
  })}

  <div class="list" class:horizontal>
    <div class="header">{which}</div>

    {#each babies[which] as baby, index (baby)}
      <div
        class="baby"
        use:sortable={{
          data: { ...baby, list: which },
          index,
        }}
      >
        {baby.name}
      </div>
    {/each}
  </div>
{/snippet}

<style>
  .container {
    display: flex;
    gap: 1rem;
  }

  div.list {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
  }

  div.horizontal.list {
    flex-direction: row;
  }

  div.baby {
    background: rgba(0, 0, 0, 0.1);
    border: 1px solid gray;
    height: 3rem;
    min-width: 12rem;
    padding: 1rem 0.5rem;
    position: relative;
  }

  div.baby:global([data-foo-dragging]) {
    opacity: 0.4;
  }

  div.baby:global([data-foo-unconcerned]) {
    cursor: not-allowed;
  }

  div.baby:global([data-foo-accepts])::before {
    box-sizing: border-box;
    content: "Swap";
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    pointer-events: none;
    user-select: none;
    background: transparent;
    inset: -1px;
    border: 2px solid black;
  }

  div.list:not(.horizontal)
    div.baby:global([data-foo-accepts][data-foo-before])::before {
    border-width: 3px 0 0 0;
    content: "Before";
  }

  div.list:not(.horizontal)
    div.baby:global([data-foo-accepts][data-foo-after])::before {
    border-width: 0 0 3px 0;
    content: "After";
  }

  div.horizontal.list
    div.baby:global([data-foo-accepts][data-foo-before])::before {
    border-width: 0 0 0 3px;
    content: "Before";
  }

  div.horizontal.list
    div.baby:global([data-foo-accepts][data-foo-after])::before {
    border-width: 0 3px 0 0;
    content: "After";
  }
</style>
