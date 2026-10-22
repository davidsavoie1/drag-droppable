<script>
  import { dndDrag, dndDrop } from "../src";

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
