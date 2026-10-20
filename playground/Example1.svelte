<script module>
  import { dnd, draggable, droppable } from "../src";
</script>

<script>
  const dragFoo = draggable({ type: "foo" });
  const dragBar = draggable({ type: "bar" });

  const dropFoo = droppable({ types: ["foo"] });
  const dropBar = droppable({ types: ["bar"] });
  const dropFooBar = droppable({ types: ["foo", "bar"] });
</script>

<section>
  <div>
    <div class="draggable" use:dnd={dragFoo}>"foo"</div>
    <div class="draggable" use:dnd={dragBar}>"bar"</div>
  </div>

  <div>
    <div class="droppable" class:can={$dropFoo.canDrop} use:dnd={dropFoo}>
      Cible pour "foo"
    </div>

    <div class="droppable" class:can={$dropBar.canDrop} use:dnd={dropBar}>
      Cible pour "bar"
    </div>

    <div class="droppable" class:can={$dropFooBar.canDrop} use:dnd={dropFooBar}>
      Cible pour "foo" et "bar"
    </div>
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

  .droppable.can {
    outline: solid 2px green;
  }
</style>
