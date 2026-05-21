import type { Heading } from "mdast";

/** The six valid mdast heading ranks. */
export type HeadingDepth = Heading["depth"];

/**
 * Heading rank bumped one level deeper, clamped at the deepest rank (6).
 *
 * A lookup table rather than `depth + 1` so the result stays within the
 * `1 | 2 | 3 | 4 | 5 | 6` union without an assertion.
 */
export const deeper: Record<HeadingDepth, HeadingDepth> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 6,
};
