// Shared benchmark measurement: times N consecutive renders per processor and
// returns structured results. Used by the report pipeline (../report.ts).
//
// Companion to `nr bench`: vitest reports a sampled per-render mean over a
// short window, which never lets V8 fully warm up on the slower libraries.
// This times N back-to-back renders after a warmup instead.
import { performance } from "node:perf_hooks";
import { mdxToJs } from "satteri";
import { compileSync } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { markdownProcessors } from "./processors.ts";
import {
	markdownPluginScenarios,
	satteriHeadingPlugin,
	satteriMdastAllPlugin,
	satteriHastAllPlugin,
	remarkHeadingPlugin,
	remarkMdastAllPlugin,
	remarkHastAllPlugin,
} from "./plugins.ts";
import { satteriFeatures } from "./parity.ts";
import { markdownFixtures, medium, mdx, largeMdx } from "./fixtures.ts";

// Small fixtures get the full 5000×; the 50× "large" fixtures would take tens
// of minutes for remark/@mdx-js at that count, so they run 100×.
export const SMALL = 5000;
export const LARGE = 100;

export type BenchGroup = "md-html" | "md-plugin" | "mdx";

export interface BenchResult {
	group: BenchGroup;
	bench: string;
	processor: string;
	count: number;
	ms: number;
}

export type ProgressFn = (message: string) => void;

async function time(count: number, run: () => unknown): Promise<number> {
	const warmup = Math.min(200, Math.ceil(count / 10));
	for (let i = 0; i < warmup; i++) await run();
	const start = performance.now();
	for (let i = 0; i < count; i++) await run();
	return performance.now() - start;
}

export async function runAllBenchmarks(
	onProgress: ProgressFn = () => {},
): Promise<BenchResult[]> {
	const results: BenchResult[] = [];

	async function record(
		group: BenchGroup,
		bench: string,
		processor: string,
		count: number,
		run: () => unknown,
	): Promise<void> {
		const ms = await time(count, run);
		results.push({ group, bench, processor, count, ms });
		onProgress(`  ${processor.padEnd(12)} ${ms.toFixed(1)} ms`);
	}

	const renderers = await Promise.all(
		markdownProcessors.map(async (processor) => ({
			name: processor.name,
			render: await processor.load(),
		})),
	);
	for (const { name, source } of markdownFixtures) {
		const count = name.startsWith("large") ? LARGE : SMALL;
		onProgress(`\n${name} (${count}×)`);
		for (const { name: processor, render } of renderers) {
			await record("md-html", name, processor, count, () => render(source));
		}
	}

	for (const scenario of markdownPluginScenarios) {
		onProgress(`\n${scenario.name} (${SMALL}×)`);
		await record("md-plugin", scenario.name, "satteri", SMALL, () =>
			scenario.satteri(medium),
		);
		await record("md-plugin", scenario.name, "remark", SMALL, () =>
			scenario.remark(medium),
		);
	}

	const satteriOptions = { features: satteriFeatures };
	const mdxBaseRemarkPlugins = [remarkFrontmatter, remarkGfm];

	const mdxScenarios = [
		{
			name: "MDX → JS",
			count: SMALL,
			satteri: () => mdxToJs(mdx, satteriOptions),
			mdxJs: () => compileSync(mdx, { remarkPlugins: mdxBaseRemarkPlugins }),
		},
		{
			name: "MDX + MDAST plugin (heading depth + 1)",
			count: SMALL,
			satteri: () =>
				mdxToJs(mdx, { ...satteriOptions, mdastPlugins: [satteriHeadingPlugin] }),
			mdxJs: () =>
				compileSync(mdx, {
					remarkPlugins: [...mdxBaseRemarkPlugins, remarkHeadingPlugin],
				}),
		},
		{
			name: "MDX + HAST plugin (count elements + uppercase text)",
			count: SMALL,
			satteri: () =>
				mdxToJs(mdx, { ...satteriOptions, hastPlugins: [satteriHastAllPlugin] }),
			mdxJs: () =>
				compileSync(mdx, {
					remarkPlugins: mdxBaseRemarkPlugins,
					rehypePlugins: [remarkHastAllPlugin],
				}),
		},
		{
			name: "MDX + both MDAST & HAST plugins",
			count: SMALL,
			satteri: () =>
				mdxToJs(mdx, {
					...satteriOptions,
					mdastPlugins: [satteriMdastAllPlugin],
					hastPlugins: [satteriHastAllPlugin],
				}),
			mdxJs: () =>
				compileSync(mdx, {
					remarkPlugins: [...mdxBaseRemarkPlugins, remarkMdastAllPlugin],
					rehypePlugins: [remarkHastAllPlugin],
				}),
		},
		{
			name: "large MDX → JS (50× document)",
			count: LARGE,
			satteri: () => mdxToJs(largeMdx, satteriOptions),
			mdxJs: () => compileSync(largeMdx, { remarkPlugins: mdxBaseRemarkPlugins }),
		},
		{
			name: "large MDX + both plugins (50× document)",
			count: LARGE,
			satteri: () =>
				mdxToJs(largeMdx, {
					...satteriOptions,
					mdastPlugins: [satteriMdastAllPlugin],
					hastPlugins: [satteriHastAllPlugin],
				}),
			mdxJs: () =>
				compileSync(largeMdx, {
					remarkPlugins: [...mdxBaseRemarkPlugins, remarkMdastAllPlugin],
					rehypePlugins: [remarkHastAllPlugin],
				}),
		},
	];
	for (const scenario of mdxScenarios) {
		onProgress(`\n${scenario.name} (${scenario.count}×)`);
		await record("mdx", scenario.name, "satteri", scenario.count, scenario.satteri);
		await record("mdx", scenario.name, "@mdx-js/mdx", scenario.count, scenario.mdxJs);
	}

	return results;
}
