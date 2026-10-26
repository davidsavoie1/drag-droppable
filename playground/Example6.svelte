<script module>
  import { dnd } from "../src";
</script>

<script>
  let babies = $state(Array.from({ length: 5 }, (_, idx) => `Baby ${idx + 1}`));
</script>

{#each babies as baby (baby)}
  <div
    use:dnd={{
      attributesPrefix: "foo",
      type: "baby",
      data: baby,
      bottomTopThreshold: 0.2,
      onDrop({ bottom, dragged, drop, top }) {
        // @ts-ignore
        const from = babies.indexOf(dragged);
        const to = babies.indexOf(drop);

        if (top || bottom) {
          babies.splice(from, 1);
          const insertion = babies.indexOf(drop) + (bottom ? 1 : 0);
          // @ts-ignore
          babies.splice(insertion, 0, dragged);
        } else {
          [babies[from], babies[to]] = [babies[to], babies[from]];
        }
      },
    }}
  >
    {baby}
  </div>
{/each}

<style>
  div {
    background: rgba(0, 0, 0, 0.1);
    border: 1px solid gray;
    border-radius: 0.5rem;
    height: 3rem;
    margin-bottom: 1rem;
    padding: 1rem 0.5rem;
    position: relative;
  }

  div:global([data-foo-dragging]) {
    opacity: 0.4;
  }

  div:global([data-foo-unconcerned]) {
    cursor: not-allowed;
  }

  div:global([data-foo-can])::before {
    content: "Swap";
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    pointer-events: none;
    user-select: none;
    background: transparent;
    inset: 0;
    border: 3px solid black;
    border-radius: inherit;
  }

  div:global([data-foo-can][data-foo-top])::before {
    border-width: 3px 0 0 0;
    content: "Before";
  }

  div:global([data-foo-can][data-foo-bottom])::before {
    border-width: 0 0 3px 0;
    content: "After";
  }
</style>
