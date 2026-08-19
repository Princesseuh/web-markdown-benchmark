// Plugin definitions for the Sätteri-vs-remark comparison, plus the composed
// markdown → HTML scenarios used by the plugin benchmark.
//
// Only Sätteri and remark appear here: markdown-it/marked/comark have
// token-stream plugin APIs that aren't comparable to the MDAST/HAST
// tree-transform model.

import { markdownToHtml, defineMdastPlugin, defineHastPlugin } from "satteri";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot } from "hast";
import { deeper } from "./heading-depth.ts";
import { satteriFeatures } from "./satteri-options.ts";

const commonMarkFeatures = satteriFeatures(false);

export const satteriHeadingPlugin = defineMdastPlugin({
  name: "heading-transform",
  heading(node, ctx) {
    ctx.setProperty(node, "depth", deeper[node.depth]);
  },
});

export const satteriMdastAllPlugin = defineMdastPlugin({
  name: "mdast-touch-all",
  heading(node, ctx) {
    ctx.setProperty(node, "depth", deeper[node.depth]);
  },
  emphasis() {},
  strong() {},
  link() {},
  code() {},
  blockquote() {},
  list() {},
  listItem() {},
  image() {},
  paragraph() {},
});

// Factory form: satteri calls it once per compile, so `count` resets per
// document, matching remark's per-tree closure below.
export const satteriHastAllPlugin = () => {
  let count = 0;
  return defineHastPlugin({
    name: "hast-touch-all",
    element: {
      filter: [],
      visit(node, ctx) {
        ctx.setProperty(node, "data-count", String(++count));
      },
    },
    text(node) {
      return { type: "text", value: node.value.toUpperCase() };
    },
  });
};

export const remarkHeadingPlugin = () => (tree: MdastRoot) => {
  visit(tree, "heading", (node) => {
    node.depth = deeper[node.depth];
  });
};

export const remarkMdastAllPlugin = () => (tree: MdastRoot) => {
  visit(tree, (node) => {
    if (node.type === "heading") node.depth = deeper[node.depth];
  });
};

export const remarkHastAllPlugin = () => (tree: HastRoot) => {
  let count = 0;
  visit(tree, (node) => {
    if (node.type === "element") {
      node.properties.dataCount = String(++count);
    }
    if (node.type === "text") {
      node.value = node.value.toUpperCase();
    }
  });
};

export interface MarkdownPluginScenario {
  name: string;
  satteri: (source: string) => string;
  remark: (source: string) => Promise<string>;
}

const remarkHeadingProcessor = unified()
  .use(remarkParse)
  .use(remarkHeadingPlugin)
  .use(remarkRehype)
  .use(rehypeStringify);

const remarkWorstCaseProcessor = unified()
  .use(remarkParse)
  .use(remarkMdastAllPlugin)
  .use(remarkRehype)
  .use(remarkHastAllPlugin)
  .use(rehypeStringify);

export const markdownPluginScenarios: MarkdownPluginScenario[] = [
  {
    name: "MDAST plugin (heading depth + 1)",
    satteri: (source) =>
      markdownToHtml(source, {
        features: commonMarkFeatures,
        mdastPlugins: [satteriHeadingPlugin],
      }).html,
    remark: async (source) => String(await remarkHeadingProcessor.process(source)),
  },
  {
    name: "MDAST + unfiltered HAST plugins (worst case)",
    satteri: (source) =>
      markdownToHtml(source, {
        features: commonMarkFeatures,
        mdastPlugins: [satteriMdastAllPlugin],
        hastPlugins: [satteriHastAllPlugin],
      }).html,
    remark: async (source) => String(await remarkWorstCaseProcessor.process(source)),
  },
];
