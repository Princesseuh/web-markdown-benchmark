// The markdown → HTML processors under comparison.
//
// To add a processor: append one entry below. Each `load()` lazily imports its
// own library, so a consumer that needs only one processor (see
// ./measure-memory.ts) never pulls the others into memory.
//
// `load(gfm)` builds a CommonMark-only or a CommonMark + GFM processor, so a
// fixture is parsed in GFM mode only when it contains GFM syntax (see
// ./fixtures.ts). marked/Sätteri cover GFM natively; markdown-it and
// markdown-exit need `linkify: true` for bare-URL autolinking; remark gets
// remark-gfm; comark registers its GFM plugins explicitly so frontmatter and
// alerts, which nobody else here parses, stay off (see ./parity.ts).
//
// Raw HTML is passed through everywhere rather than escaped or dropped, hence `allowDangerousHtml`.

import type MarkdownIt from "markdown-it";
import { satteriFeatures } from "./satteri-options.ts";

/** A configured markdown → HTML conversion. Sync or async depending on the library. */
export type RenderMarkdown = (source: string) => string | Promise<string>;

export interface MarkdownProcessor {
  name: string;
  /** Libraries missing GFM syntax sit out the GFM fixture instead of posting a time for work they skip. */
  supportsGfm: boolean;
  load: (gfm: boolean) => Promise<RenderMarkdown>;
}

// comark always enables tables and strikethrough on its markdown-it core, so only a plugin can reach in and undo it.
const comarkWithoutGfm = {
  name: "no-gfm",
  markdownItPlugins: [
    (md: InstanceType<typeof MarkdownIt>) => void md.disable(["table", "strikethrough"]),
  ],
};

export const markdownProcessors: MarkdownProcessor[] = [
  {
    name: "satteri",
    supportsGfm: true,
    async load(gfm) {
      const { markdownToHtml } = await import("satteri");
      const features = satteriFeatures(gfm);
      return (source) => markdownToHtml(source, { features }).html;
    },
  },
  {
    name: "remark",
    supportsGfm: true,
    async load(gfm) {
      const { unified } = await import("unified");
      const { default: remarkParse } = await import("remark-parse");
      const { default: remarkGfm } = await import("remark-gfm");
      const { default: remarkRehype } = await import("remark-rehype");
      const { default: rehypeStringify } = await import("rehype-stringify");
      const parser = unified().use(remarkParse);
      const processor = (gfm ? parser.use(remarkGfm) : parser)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true });
      return async (source) => String(await processor.process(source));
    },
  },
  {
    name: "markdown-it",
    supportsGfm: false,
    async load(gfm) {
      const { default: MarkdownIt } = await import("markdown-it");
      const md = new MarkdownIt({ linkify: gfm, html: true });
      if (!gfm) md.disable(["table", "strikethrough"]);
      return (source) => md.render(source);
    },
  },
  {
    name: "markdown-exit",
    supportsGfm: false,
    async load(gfm) {
      const { createMarkdownExit } = await import("markdown-exit");
      const md = createMarkdownExit({ linkify: gfm, html: true });
      if (!gfm) md.disable(["table", "strikethrough"]);
      return (source) => md.render(source);
    },
  },
  {
    name: "marked",
    supportsGfm: true,
    async load(gfm) {
      const { Marked } = await import("marked");
      const md = new Marked({ gfm });
      return (source) => md.parse(source);
    },
  },
  {
    name: "comark",
    supportsGfm: true,
    async load(gfm) {
      const { createMarkdownParser } = await import("comark");
      const { render } = await import("comark/render");
      const { default: taskList } = await import("comark/plugins/task-list");
      const { default: components } = await import("comark/plugins/components");
      const { default: footnotes } = await import("comark/plugins/footnotes");
      const { default: html } = await import("comark/plugins/html");
      // comark's footnotes plugin is a no-op without `components`, which is what parses the `[^ref]` brackets.
      const gfmPlugins = gfm ? [taskList(), components(), footnotes()] : [comarkWithoutGfm];
      const parse = createMarkdownParser({
        registerDefaultPlugins: false,
        plugins: [...gfmPlugins, html()],
        linkify: gfm,
        autoClose: false,
        headingIds: false,
      });
      return async (source) => render(await parse(source), { format: "text/html" });
    },
  },
];
