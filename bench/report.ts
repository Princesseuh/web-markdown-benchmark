// Benchmark report pipeline: measure → results.json → SVG charts → README.
//
// Results are tracked per environment, so a local run and a scheduled CI run
// on different hardware each keep their own README section. A run upserts only
// its own environment and leaves the others untouched. One idempotent command,
// safe for CI to run and commit the diff.
//
//   nr bench:report                measure this machine, upsert it, rebuild
//   nr bench:report --env "CI"     store results under a fixed label (use
//                                  this in CI, since runner hardware varies)
//   nr bench:report --reuse        skip measuring, rebuild charts + README
//                                  from the existing results.json
//   nr bench:report --dry-run      measure and print a summary, write nothing
import {
	writeFileSync,
	readFileSync,
	mkdirSync,
	rmSync,
	existsSync,
} from "node:fs";
import { cpus } from "node:os";
import { runAllBenchmarks, type BenchResult } from "./utils/measure.ts";
import { renderChart, type ChartPanel } from "./utils/svg.ts";

interface Environment {
	cpu: string;
	node: string;
	generatedAt: string;
	packages?: Record<string, string>;
	results: BenchResult[];
}
interface ResultsFile {
	primary: string;
	environments: Record<string, Environment>;
}
interface Benchmark {
	bench: string;
	count: number;
	rows: BenchResult[];
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const reuse = argv.includes("--reuse");
const envFlag = argv[argv.indexOf("--env") + 1];

const resultsUrl = new URL("results.json", import.meta.url);
const chartsRoot = new URL("charts/", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);

// In display order.
const benchmarkedPackages = [
	"satteri",
	"remark",
	"markdown-it",
	"marked",
	"comark",
	"@mdx-js/mdx",
];

function loadResultsFile(): ResultsFile {
	if (!existsSync(resultsUrl)) return { primary: "", environments: {} };
	const parsed = JSON.parse(readFileSync(resultsUrl, "utf-8"));
	if (parsed.environments) return parsed;
	// Migrate the earlier single-environment format.
	if (Array.isArray(parsed.results)) {
		const label = parsed.cpu ?? "unknown";
		return {
			primary: label,
			environments: {
				[label]: {
					cpu: parsed.cpu ?? "unknown",
					node: parsed.node ?? process.version,
					generatedAt: parsed.generatedAt ?? new Date().toISOString(),
					results: parsed.results,
				},
			},
		};
	}
	return { primary: "", environments: {} };
}

const file = loadResultsFile();

function readPackageVersions(): Record<string, string> {
	const versions: Record<string, string> = {};
	for (const name of benchmarkedPackages) {
		const manifest = new URL(
			`../node_modules/${name}/package.json`,
			import.meta.url,
		);
		versions[name] = JSON.parse(readFileSync(manifest, "utf-8")).version;
	}
	return versions;
}

// Backfill versions onto environments saved before they were tracked.
const packageVersions = readPackageVersions();
for (const env of Object.values(file.environments)) {
	if (!env.packages || Object.keys(env.packages).length === 0) {
		env.packages = packageVersions;
	}
}

if (!reuse) {
	const cpu = cpus()[0]
		.model.replace(/\s+\d+-Core Processor$/, "")
		.trim();
	const label = envFlag ?? cpu;
	const results = await runAllBenchmarks((message) => console.error(message));

	if (dryRun) {
		for (const benchmark of [
			...benchmarksOf(results, "md-html"),
			...benchmarksOf(results, "md-plugin"),
			...benchmarksOf(results, "mdx"),
		]) {
			console.log(`\n${benchmark.bench} (${benchmark.count}×)`);
			for (const row of [...benchmark.rows].sort((a, b) => a.ms - b.ms)) {
				console.log(`  ${row.processor.padEnd(12)} ${Math.round(row.ms)} ms`);
			}
		}
		console.log("\n--dry-run: no files written");
		process.exit(0);
	}

	file.environments[label] = {
		cpu,
		node: process.version,
		generatedAt: new Date().toISOString(),
		packages: packageVersions,
		results,
	};
	if (!file.primary) file.primary = label;
}

if (Object.keys(file.environments).length === 0) {
	throw new Error(
		"results.json has no environments; run without --reuse first",
	);
}

const orderedLabels = [
	file.primary,
	...Object.keys(file.environments).filter((label) => label !== file.primary),
].filter((label) => label in file.environments);

function benchmarksOf(results: BenchResult[], group: string): Benchmark[] {
	const order: string[] = [];
	const byBench = new Map<string, BenchResult[]>();
	for (const result of results) {
		if (result.group !== group) continue;
		let rows = byBench.get(result.bench);
		if (!rows) {
			rows = [];
			byBench.set(result.bench, rows);
			order.push(result.bench);
		}
		rows.push(result);
	}
	return order.map((bench) => ({
		bench,
		count: byBench.get(bench)![0].count,
		rows: byBench.get(bench)!,
	}));
}

const msOf = (rows: BenchResult[], processor: string): number =>
	rows.find((row) => row.processor === processor)!.ms;

function panel(title: string, rows: BenchResult[]): ChartPanel {
	return {
		title,
		bars: [...rows]
			.sort((a, b) => a.ms - b.ms)
			.map((row) => ({
				label: row.processor,
				value: row.ms,
				highlight: row.processor === "satteri",
			})),
	};
}

function chartsFor(results: BenchResult[]): Record<string, string> {
	const mdHtml = benchmarksOf(results, "md-html");
	const mdPlugin = benchmarksOf(results, "md-plugin");
	const mdx = benchmarksOf(results, "mdx");
	return {
		"markdown-to-html.svg": renderChart(
			mdHtml.map((b) => panel(`${b.bench} → HTML (${b.count}×)`, b.rows)),
		),
		"markdown-plugins.svg": renderChart(
			mdPlugin.map((b) => panel(`${b.bench} (${b.count}×)`, b.rows)),
		),
		"mdx-to-js.svg": renderChart(
			mdx.map((b) => panel(`${b.bench} (${b.count}×)`, b.rows)),
		),
	};
}

const fmt = (ms: number): string => Math.round(ms).toLocaleString("en-US");

type Align = "l" | "r";
function table(headers: string[], align: Align[], rows: string[][]): string {
	const width = headers.map((header, i) =>
		Math.max(header.length, ...rows.map((row) => row[i].length)),
	);
	const cell = (text: string, i: number): string =>
		align[i] === "r" ? text.padStart(width[i]) : text.padEnd(width[i]);
	const line = (cells: string[]): string =>
		`| ${cells.map(cell).join(" | ")} |`;
	const separator = `| ${width
		.map((w, i) => (align[i] === "r" ? `${"-".repeat(w - 1)}:` : "-".repeat(w)))
		.join(" | ")} |`;
	return [line(headers), separator, ...rows.map(line)].join("\n");
}

const shortFixture: Record<string, string> = {
	"simple markdown": "simple",
	"medium markdown": "medium",
	"GFM markdown": "GFM",
	"large document (50× medium)": "large 50×",
};

function tablesFor(results: BenchResult[]): {
	mdHtml: string;
	mdPlugin: string;
	mdx: string;
} {
	const mdHtml = benchmarksOf(results, "md-html");
	const mdPlugin = benchmarksOf(results, "md-plugin");
	const mdx = benchmarksOf(results, "mdx");

	// Order parsers fastest-first by their medium-fixture time.
	const speedOrder = [
		...mdHtml.find((b) => b.bench === "medium markdown")!.rows,
	]
		.sort((a, b) => a.ms - b.ms)
		.map((row) => row.processor);

	return {
		mdHtml: table(
			[
				"Parser",
				...mdHtml.map((b) => `${shortFixture[b.bench]}<br>(${b.count}×, ms)`),
			],
			["l", "r", "r", "r", "r"],
			speedOrder.map((processor) => [
				processor,
				...mdHtml.map((b) => fmt(msOf(b.rows, processor))),
			]),
		),
		mdPlugin: table(
			["Scenario", "satteri (ms)", "remark (ms)"],
			["l", "r", "r"],
			mdPlugin.map((b) => [
				b.bench,
				fmt(msOf(b.rows, "satteri")),
				fmt(msOf(b.rows, "remark")),
			]),
		),
		mdx: table(
			["Scenario", "Renders", "satteri (ms)", "@mdx-js/mdx (ms)"],
			["l", "r", "r", "r"],
			mdx.map((b) => [
				b.bench,
				`${b.count}×`,
				fmt(msOf(b.rows, "satteri")),
				fmt(msOf(b.rows, "@mdx-js/mdx")),
			]),
		),
	};
}

const slug = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

// Charts lead each subsection; the exact numbers sit in a collapsed block.
const collapsed = (table: string): string =>
	`<details>\n<summary>Raw numbers</summary>\n\n${table}\n\n</details>`;

function sectionFor(label: string, env: Environment): string {
	const dir = slug(label);
	const date = env.generatedAt.slice(0, 10);
	const meta =
		label === env.cpu
			? `_Node ${env.node}, ${date}._`
			: `_${env.cpu}, Node ${env.node}, ${date}._`;
	const tables = tablesFor(env.results);
	return `### ${label}

${meta}

#### Markdown → HTML

![Markdown to HTML benchmark](./bench/charts/${dir}/markdown-to-html.svg)

${collapsed(tables.mdHtml)}

#### Markdown → HTML with plugins

![Markdown plugins benchmark](./bench/charts/${dir}/markdown-plugins.svg)

${collapsed(tables.mdPlugin)}

#### MDX → JS

![MDX to JS benchmark](./bench/charts/${dir}/mdx-to-js.svg)

${collapsed(tables.mdx)}`;
}

rmSync(chartsRoot, { recursive: true, force: true });
for (const label of orderedLabels) {
	const dir = new URL(`${slug(label)}/`, chartsRoot);
	mkdirSync(dir, { recursive: true });
	for (const [name, svg] of Object.entries(
		chartsFor(file.environments[label].results),
	)) {
		writeFileSync(new URL(name, dir), `${svg}\n`);
	}
}

const primaryPackages =
	file.environments[file.primary]?.packages ?? packageVersions;
const versionList = benchmarkedPackages
	.filter((name) => primaryPackages[name])
	.map((name) => `\`${name}@${primaryPackages[name]}\``)
	.join(", ");
const intro = `<!-- Generated by \`nr bench:report\`. Do not edit this section by hand. -->

Wall-clock time for N consecutive renders after warmup. Lower is better.

Fixtures: [simple](./bench/fixtures/simple.md) \`0.2 KB\`, [medium](./bench/fixtures/medium.md) \`10 KB\`, [GFM](./bench/fixtures/gfm.md) \`8 KB\`, large \`≈500 KB\` (medium ×50).

Package versions: ${versionList}.`;

const block = [
	intro,
	...orderedLabels.map((label) => sectionFor(label, file.environments[label])),
].join("\n\n");

const START = "<!-- bench:start -->";
const END = "<!-- bench:end -->";
const readme = readFileSync(readmeUrl, "utf-8");
const startAt = readme.indexOf(START);
const endAt = readme.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt < startAt) {
	throw new Error(
		`README.md must contain "${START}" and "${END}" markers in the Results section`,
	);
}
writeFileSync(
	readmeUrl,
	`${readme.slice(0, startAt + START.length)}\n\n${block}\n\n${readme.slice(endAt)}`,
);

writeFileSync(resultsUrl, `${JSON.stringify(file, null, "\t")}\n`);

console.error(
	`\nWrote results.json, charts for ${orderedLabels.length} environment(s), and the README Results section.`,
);
