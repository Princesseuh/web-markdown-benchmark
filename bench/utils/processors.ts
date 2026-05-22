// The markdown → HTML processors under comparison.
//
// To add a processor: append one entry below. Each `load()` lazily imports its
// own library, so a consumer that needs only one processor (see
// ./measure-memory.ts) never pulls the others into memory.
//
// Every processor is configured for CommonMark + GFM so they do equivalent
// work. marked/Sätteri/comark enable GFM by default; markdown-it needs
// `linkify: true` for GFM bare-URL autolinking; remark gets remark-gfm added
// explicitly (see ./parity.ts).

import { satteriFeatures } from "./satteri-options.ts";

/** A configured markdown → HTML conversion. Sync or async depending on the library. */
export type RenderMarkdown = (source: string) => string | Promise<string>;

export interface MarkdownProcessor {
  name: string;
  load: () => Promise<RenderMarkdown>;
}

export const markdownProcessors: MarkdownProcessor[] = [
  {
    name: "satteri",
    async load() {
      const { markdownToHtml } = await import("satteri");
      return (source) => markdownToHtml(source, { features: satteriFeatures }).html;
    },
  },
  {
    name: "remark",
    async load() {
      const { unified } = await import("unified");
      const { default: remarkParse } = await import("remark-parse");
      const { default: remarkGfm } = await import("remark-gfm");
      const { default: remarkRehype } = await import("remark-rehype");
      const { default: rehypeStringify } = await import("rehype-stringify");
      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeStringify);
      return async (source) => String(await processor.process(source));
    },
  },
  {
    name: "markdown-it",
    async load() {
      const { default: MarkdownIt } = await import("markdown-it");
      const md = new MarkdownIt({ linkify: true });
      return (source) => md.render(source);
    },
  },
  {
    name: "marked",
    async load() {
      const { marked } = await import("marked");
      marked.use({ gfm: true });
      return (source) => marked.parse(source);
    },
  },
  {
    name: "comark",
    async load() {
      const { createParse } = await import("comark");
      const { render } = await import("comark/render");
      const parse = createParse({
        autoClose: false,
        html: false,
        autoUnwrap: false,
      });
      return async (source) => render(await parse(source), { format: "text/html" });
    },
  },
];
