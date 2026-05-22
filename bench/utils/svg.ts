// Hand-rolled SVG bar charts. Avoiding a chart library keeps the report
// pipeline (../report.ts) dependency-free and its output deterministic, so
// scheduled CI runs produce clean diffs.
//
// Each panel is an independently scaled linear bar chart: bars are sized
// against that panel's own slowest entry, so a fast parser stays visible even
// when another in the same panel is two orders of magnitude slower.

export interface ChartBar {
	label: string;
	value: number;
	highlight?: boolean;
}

export interface ChartPanel {
	title: string;
	bars: ChartBar[];
	unit?: "ms" | "MB";
}

const WIDTH = 760;
const SIDE_PAD = 20;
const LEFT_GUTTER = 96;
const LABEL_ZONE = 96;
const BAR_ZONE = WIDTH - SIDE_PAD * 2 - LEFT_GUTTER - LABEL_ZONE;
const ROW_HEIGHT = 28;
const BAR_HEIGHT = 16;
const PANEL_HEAD = 30;
const PANEL_GAP = 16;
const TOP_PAD = 14;

const COLOR = {
	background: "#ffffff",
	border: "#d0d7de",
	heading: "#1f2328",
	label: "#1f2328",
	value: "#1f2328",
	track: "#eef1f4",
	bar: "#9aa7b8",
	highlight: "#2f6feb",
};

const escapeXml = (text: string): string =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatValue = (value: number, unit: "ms" | "MB"): string =>
	unit === "MB"
		? `${value.toFixed(1)} MB`
		: `${Math.round(value).toLocaleString("en-US")} ms`;

export function renderChart(panels: ChartPanel[]): string {
	const barX = SIDE_PAD + LEFT_GUTTER;
	let height = TOP_PAD;
	for (const panel of panels) {
		height += PANEL_HEAD + panel.bars.length * ROW_HEIGHT + PANEL_GAP;
	}

	const body: string[] = [];
	let y = TOP_PAD;
	for (const panel of panels) {
		body.push(
			`<text x="${SIDE_PAD}" y="${y + 19}" class="heading">${escapeXml(panel.title)}</text>`,
		);
		y += PANEL_HEAD;

		const max = Math.max(...panel.bars.map((bar) => bar.value), 1);
		for (const bar of panel.bars) {
			const mid = y + ROW_HEIGHT / 2;
			const barY = mid - BAR_HEIGHT / 2;
			const textY = mid + 4;
			const width = Math.max(2, (bar.value / max) * BAR_ZONE);
			const fill = bar.highlight ? COLOR.highlight : COLOR.bar;
			body.push(
				`<text x="${barX - 10}" y="${textY}" class="label" text-anchor="end">${escapeXml(bar.label)}</text>`,
				`<rect x="${barX}" y="${barY}" width="${BAR_ZONE}" height="${BAR_HEIGHT}" rx="3" class="track"/>`,
				`<rect x="${barX}" y="${barY}" width="${width.toFixed(1)}" height="${BAR_HEIGHT}" rx="3" fill="${fill}"/>`,
				`<text x="${barX + BAR_ZONE + 8}" y="${textY}" class="value">${formatValue(bar.value, panel.unit ?? "ms")}</text>`,
			);
			y += ROW_HEIGHT;
		}
		y += PANEL_GAP;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="system-ui, sans-serif">
<style>
.heading{font-size:13px;font-weight:600;fill:${COLOR.heading}}
.label{font-size:12px;fill:${COLOR.label}}
.value{font-size:12px;font-weight:600;fill:${COLOR.value}}
.track{fill:${COLOR.track}}
</style>
<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="8" fill="${COLOR.background}" stroke="${COLOR.border}"/>
${body.join("\n")}
</svg>`;
}
