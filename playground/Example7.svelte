<script module>
  import { createSortable } from "../src";
</script>

<script>
  const horizontal = false;

  let babies = $state(Array.from({ length: 5 }, (_, idx) => `Baby ${idx}`));

  const sortable = createSortable({
    horizontal,
    noAfter: true,
    noSwap: true,
    onListChange: (/** @type {string[]} */ list) => (babies = [...list]),
  });
</script>

<div class="list" class:horizontal>
  {#each babies as baby, index (baby)}
    <div
      class="baby"
      use:sortable={{
        attributesPrefix: "foo",
        leftRightThreshold: 0.2,
        bottomTopThreshold: 0.2,
        type: "baby",
        data: baby,
        index,
      }}
    >
      {baby}
    </div>
  {/each}
</div>

<style>
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
    div.baby:global([data-foo-accepts][data-foo-top])::before {
    border-width: 3px 0 0 0;
    content: "Before";
  }

  div.list:not(.horizontal)
    div.baby:global([data-foo-accepts][data-foo-bottom])::before {
    border-width: 0 0 3px 0;
    content: "After";
  }

  div.horizontal.list
    div.baby:global([data-foo-accepts][data-foo-left])::before {
    border-width: 0 0 0 3px;
    content: "Before";
  }

  div.horizontal.list
    div.baby:global([data-foo-accepts][data-foo-right])::before {
    border-width: 0 3px 0 0;
    content: "After";
  }
</style>
