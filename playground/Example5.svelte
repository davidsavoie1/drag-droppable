<script module>
  import { dndDrag, dndDrop } from "../src";
</script>

<script>
  const babies = Array.from({ length: 100 }, (_, idx) => `Baby ${idx + 1}`);
</script>

<p>
  En version tactile, déplacer la nourriture dans la liste des bébés pour tester
  les paramètres de défilement.
</p>

<div use:dndDrag={{ type: "food" }}>Food</div>

{#each babies as baby (baby)}
  <div use:dndDrop={{ type: "food", data: baby }}>
    {baby}
  </div>
{/each}
