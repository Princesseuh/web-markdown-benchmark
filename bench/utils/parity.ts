import type { Features } from "satteri";

/**
 * The feature set every benchmark pins so Sätteri and remark do equal work:
 * CommonMark + GFM + frontmatter, and nothing else.
 *
 * `gfm` and `frontmatter` are already Sätteri defaults — set here anyway so the
 * parity is explicit rather than implied. `math` and `headingAttributes` are
 * Sätteri defaults too; they are turned off because remark has no equivalent
 * wired up and no fixture exercises them, so leaving them on would only make
 * Sätteri probe for syntax remark never looks for.
 *
 * The remark side matches this with `remark-frontmatter` + `remark-gfm`.
 */
export const satteriFeatures: Features = {
  gfm: true,
  frontmatter: true,
  math: false,
  headingAttributes: false,
};
