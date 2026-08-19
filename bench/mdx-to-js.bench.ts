import { bench, describe } from "vitest";
import { mdxToJs } from "satteri";
import { compileSync } from "@mdx-js/mdx";
import { mdx, largeMdx } from "./utils/fixtures.ts";
import { satteriFeatures } from "./utils/satteri-options.ts";
import {
  satteriHeadingPlugin,
  satteriMdastAllPlugin,
  satteriHastAllPlugin,
  remarkHeadingPlugin,
  remarkMdastAllPlugin,
  remarkHastAllPlugin,
} from "./utils/plugins.ts";

const satteriOptions = { features: satteriFeatures(false) };

interface MdxPluginScenario {
  name: string;
  satteri: () => unknown;
  mdxJs: () => unknown;
}

const pluginScenarios: MdxPluginScenario[] = [
  {
    name: "MDX + MDAST plugin (heading depth + 1)",
    satteri: () => mdxToJs(mdx, { ...satteriOptions, mdastPlugins: [satteriHeadingPlugin] }),
    mdxJs: () =>
      compileSync(mdx, {
        remarkPlugins: [remarkHeadingPlugin],
      }),
  },
  {
    name: "MDX + HAST plugin (count elements + uppercase text)",
    satteri: () => mdxToJs(mdx, { ...satteriOptions, hastPlugins: [satteriHastAllPlugin] }),
    mdxJs: () =>
      compileSync(mdx, {
        rehypePlugins: [remarkHastAllPlugin],
      }),
  },
  {
    name: "MDX + both MDAST & HAST plugins",
    satteri: () =>
      mdxToJs(mdx, {
        ...satteriOptions,
        mdastPlugins: [satteriMdastAllPlugin],
        hastPlugins: [satteriHastAllPlugin],
      }),
    mdxJs: () =>
      compileSync(mdx, {
        remarkPlugins: [remarkMdastAllPlugin],
        rehypePlugins: [remarkHastAllPlugin],
      }),
  },
];

describe("MDX → JS", () => {
  bench("satteri", () => {
    mdxToJs(mdx, satteriOptions);
  });
  bench("@mdx-js/mdx", () => {
    compileSync(mdx);
  });
});

for (const scenario of pluginScenarios) {
  describe(scenario.name, () => {
    bench("satteri", () => {
      scenario.satteri();
    });
    bench("@mdx-js/mdx", () => {
      scenario.mdxJs();
    });
  });
}

// @mdx-js/mdx needs a longer measurement window on the large fixture.
const slowBench = { time: 5000, warmupTime: 1000 };

describe("large MDX → JS (50× document)", () => {
  bench("satteri", () => {
    mdxToJs(largeMdx, satteriOptions);
  });
  bench(
    "@mdx-js/mdx",
    () => {
      compileSync(largeMdx);
    },
    slowBench,
  );
});

describe("large MDX + both plugins (50× document)", () => {
  bench("satteri", () => {
    mdxToJs(largeMdx, {
      ...satteriOptions,
      mdastPlugins: [satteriMdastAllPlugin],
      hastPlugins: [satteriHastAllPlugin],
    });
  });
  bench(
    "@mdx-js/mdx",
    () => {
      compileSync(largeMdx, {
        remarkPlugins: [remarkMdastAllPlugin],
        rehypePlugins: [remarkHastAllPlugin],
      });
    },
    slowBench,
  );
});
