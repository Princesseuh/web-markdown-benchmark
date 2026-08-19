import { bench, describe } from "vitest";
import { markdownProcessors, type RenderMarkdown } from "./utils/processors.ts";
import { markdownFixtures, medium } from "./utils/fixtures.ts";
import { markdownPluginScenarios } from "./utils/plugins.ts";

// Resolve every processor once up front so the bench bodies time only the
// conversion, not the library import.
function renderersFor(gfm: boolean) {
  const processors = gfm ? markdownProcessors.filter((p) => p.supportsGfm) : markdownProcessors;
  return Promise.all(
    processors.map(async (processor) => ({
      name: processor.name,
      render: await processor.load(gfm),
    })),
  );
}

const [commonMarkRenderers, gfmRenderers] = await Promise.all([
  renderersFor(false),
  renderersFor(true),
]);

// Returns the promise for async processors so vitest awaits and times it; sync
// processors return nothing and are measured without async overhead.
function run(render: RenderMarkdown, source: string): void | Promise<void> {
  const result = render(source);
  if (result instanceof Promise) return result.then(() => {});
}

for (const { name, source, gfm } of markdownFixtures) {
  describe(`${name} → HTML`, () => {
    for (const { name: processor, render } of gfm ? gfmRenderers : commonMarkRenderers) {
      bench(processor, () => run(render, source));
    }
  });
}

// Plugin benchmarks compare Sätteri against remark only (see ./plugins.ts).
for (const scenario of markdownPluginScenarios) {
  describe(`${scenario.name} — Sätteri vs remark`, () => {
    bench("satteri", () => {
      scenario.satteri(medium);
    });
    bench("remark", () => scenario.remark(medium).then(() => {}));
  });
}
