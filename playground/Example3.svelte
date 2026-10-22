<script>
  import { dndDrag, dndDrop } from "../src";

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
