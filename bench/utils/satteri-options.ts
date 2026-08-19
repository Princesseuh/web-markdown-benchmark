import type { Features } from "satteri";

export function satteriFeatures(gfm: boolean): Features {
  return {
    gfm,
    frontmatter: false,
    math: false,
    headingAttributes: false,
  };
}
