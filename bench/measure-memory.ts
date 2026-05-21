// Run with: pnpm bench:memory <library>   (e.g. pnpm bench:memory satteri)
// Measures peak RSS while parsing the large fixture (50× medium.md).
//
// Uses /proc/self/status VmHWM (kernel-tracked peak RSS high-water mark) so we
// catch allocations made by native code during the parse — JS-side sampling
// can't see those because the main thread is blocked inside the native call.
// VmHWM is reset via /proc/self/clear_refs after warmup so the baseline is clean.
//
// The processor registry loads each library lazily, so only the one being
// measured is imported and contributes to the RSS baseline.

import { readFileSync, writeFileSync } from "node:fs";
import { markdownProcessors } from "./utils/processors.ts";
import { largeMarkdown } from "./utils/fixtures.ts";

const { gc } = globalThis;
if (!gc) {
  console.error("measure-memory must be run with --expose-gc");
  process.exit(1);
}

const requested = process.argv[2];
const processor = markdownProcessors.find((entry) => entry.name === requested);
if (!processor) {
  const names = markdownProcessors.map((entry) => entry.name).join("|");
  console.error(`usage: node --expose-gc measure-memory.ts <${names}>`);
  process.exit(1);
}

const render = await processor.load();
const parse = () => render(largeMarkdown);

interface VmSample {
  rssKB: number;
  hwmKB: number;
}

function vmField(status: string, name: string): number {
  const match = status.match(new RegExp(`${name}:\\s+(\\d+)`));
  if (!match) throw new Error(`field ${name} not found in /proc/self/status`);
  return Number(match[1]);
}

function readVm(): VmSample {
  const status = readFileSync("/proc/self/status", "utf8");
  return {
    rssKB: vmField(status, "VmRSS"),
    hwmKB: vmField(status, "VmHWM"),
  };
}

function byteLength(value: unknown): number {
  return typeof value === "string" ? value.length : String(value).length;
}

// Warmup, GC, then reset the peak-RSS high-water mark.
await parse();
await parse();
gc();
gc();
writeFileSync("/proc/self/clear_refs", "5\n");

const baseline = readVm();

// N parses; lastResult keeps the final string alive at the "after" sample.
const N = 20;
let lastResult: unknown = await parse();
for (let i = 1; i < N; i++) {
  lastResult = await parse();
}

const afterParse = readVm();

// GC again, see how much is reclaimable.
gc();
gc();
const afterGc = readVm();

console.log(
  JSON.stringify(
    {
      lib: processor.name,
      resultBytes: byteLength(lastResult),
      parsesPerTrial: N,
      baselineRssKB: baseline.rssKB,
      baselineHwmKB: baseline.hwmKB,
      peakHwmDeltaKB: afterParse.hwmKB - baseline.hwmKB,
      postParseRssKB: afterParse.rssKB,
      postGcRssKB: afterGc.rssKB,
      retainedAfterGcKB: afterGc.rssKB - baseline.rssKB,
    },
    null,
    2,
  ),
);
