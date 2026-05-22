// Markdown and MDX fixtures shared by the benchmarks and the measurement
// scripts. Files are read once at import time.

import { readFileSync } from "node:fs";

function read(file: string): string {
  return readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf-8");
}

export interface Fixture {
  /** Heading used for the describe/test block, e.g. "medium markdown". */
  name: string;
  source: string;
}

const simple = read("simple.md");
export const medium = read("medium.md");
const gfm = read("gfm.md");
export const mdx = read("mdx.mdx");

// A document repeated `count` times, each copy given unique section headings so
// no two copies collide.
function scaleMarkdown(source: string, count: number): string {
  return Array.from({ length: count }, (_, i) =>
    source.replace(/^# /m, `# Section ${i + 1}\n\n# `),
  ).join("\n\n---\n\n");
}

// Same as scaleMarkdown for MDX: import/export lines are hoisted to the top once
// so the repeated copies don't redeclare the same bindings.
function scaleMdx(source: string, count: number): string {
  const lines = source.split("\n");
  const isDeclaration = (line: string) => /^(import |export )/.test(line);
  const declarations = lines.filter(isDeclaration).join("\n");
  const body = lines.filter((line) => !isDeclaration(line)).join("\n");
  return `${declarations}\n\n${scaleMarkdown(body, count)}`;
}

export const largeMarkdown = scaleMarkdown(medium, 50);
export const largeMdx = scaleMdx(mdx, 50);

/** The fixtures swept by the markdown → HTML benchmark. */
export const markdownFixtures: Fixture[] = [
  { name: "simple markdown", source: simple },
  { name: "medium markdown", source: medium },
  { name: "GFM markdown", source: gfm },
  { name: "large document (50× medium)", source: largeMarkdown },
];
