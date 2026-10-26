<script>
  import { dndDrag, dndDrop } from "../src";

  let babies = $state([
    { name: "Mia", hunger: 6 },
    { name: "Zoe", hunger: 2, sleeping: true },
  ]);

  let meals = $state([
    { name: "good", quality: 2, spoonfuls: 3 },
    { name: "bad", quality: 1, spoonfuls: 4 },
  ]);

  let timeout = $state();

  function feedBaby({ drag: meal, drop: baby }) {
    meal.spoonfuls -= 1;
    baby.hunger = Math.max(0, baby.hunger - meal.quality);
  }

  function leoComesRunning() {
    if (babies.some((b) => b.name === "Leo")) return;
    babies = [...babies, { name: "Leo", hunger: 3 }];
  }
</script>

{#each meals as meal (meal.name)}
  <div
    ondragstart={() => {
      clearTimeout(timeout);
      timeout = setTimeout(leoComesRunning, 1000);
    }}
    ondragend={() => {
      clearTimeout(timeout);
    }}
    role="figure"
    use:dndDrag={{
      type: "food",
      data: meal,
      disabled: meal.spoonfuls <= 0,
    }}
  >
    {meal.name} food: {meal.spoonfuls} spoonfuls left of quality {meal.quality}
  </div>
{/each}

{#each babies as baby (baby.name)}
  <div
    class:sleeping={baby.sleeping}
    role="figure"
    ondragenter={() => {
      if (baby.sleeping) baby.sleeping = false;
    }}
    use:dndDrop={{
      type: "food",
      data: baby,
      disabled: baby.sleeping,
      // unless: ({ drop: baby }) => baby.sleeping,
      when: ({ drop }) => drop.hunger > 0,
      onDrop: feedBaby,
    }}
  >
    {baby.name}: {baby.hunger > 0
      ? `Hunger: ${baby.hunger}`
      : "Full. Ask again in five minutes."}
  </div>
{/each}

<style>
  .sleeping {
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    border: solid 1px #115e59;
    min-height: 4rem;
    opacity: 0.5;
  }
</style>
