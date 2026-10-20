import { configureTouchDnD } from "./touchDnd.js";

const DEFAULT_CONFIG = {
  /* Prefix used with data-[prefix]-* attributes
   * (ie data-dnd-concerned). */
  attributesPrefix: "dnd",
};

let config = DEFAULT_CONFIG;

export default function configureDnD({ touch, ...rest }) {
  if (touch !== undefined) {
    configureTouchDnD(touch);
  }

  config = { ...DEFAULT_CONFIG, ...rest };
}

export function getConfig() {
  return config;
}
