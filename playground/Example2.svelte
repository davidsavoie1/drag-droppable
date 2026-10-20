<script module>
  import { dndDrag, dndDrop } from "../src";
</script>

<script>
</script>

<section>
  <div>
    {#each ["foo", "bar", "baz"] as type (type)}
      <div class="draggable" use:dndDrag={{ type }}>"{type}"</div>
    {/each}
  </div>

  <div>
    {#each [["foo"], ["bar"], ["foo", "bar"]] as types (types.join("+"))}
      <div
        class="droppable"
        use:dndDrop={{
          attributesPrefix: "foo",
          types,
          unless: (_, type) => type.includes("bar"),
        }}
      >
        Cible pour "{types.join('", "')}"
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

  .draggable,
  .droppable {
    border: 1px solid gray;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
  }

  .draggable {
    background-color: aqua;
    height: 4rem;
  }

  .droppable {
    background-color: beige;
    height: 5rem;
  }

  .draggable:global([data-dnd-dragging]) {
    outline: solid 2px red;
  }

  .droppable:global([data-foo-concerned]) {
    outline: dashed 1px blue;
  }

  .droppable:global([data-foo-can]) {
    outline: solid 2px green;
  }

  .droppable:global([data-foo-unconcerned]) {
    outline: solid 1px red;
  }
</style>
