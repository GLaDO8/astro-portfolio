/**
 * Pure, deterministic vinyl layout and SVG generation. Intended for build-time
 * use: fetch album metadata once, then pass the resulting SVG to the widget.
 * Durations model a hypothetical pressing, not a release's actual side breaks.
 */
const MINUTE = 60_000;
const SIDE_LIMIT = 22 * MINUTE;

/** Preserve track order; use the fewest sides, then balance their durations. */
export function layoutVinylAlbum(tracks, selectedTrackId) {
	if (!tracks.length) throw new Error("The album has no tracks.");
	const ordered = [...tracks].sort(
		(a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber,
	);
	const ids = new Set();
	for (const track of ordered) {
		if (
			!Number.isFinite(track.durationMs) ||
			track.durationMs <= 0 ||
			!Number.isInteger(track.discNumber) ||
			track.discNumber < 1 ||
			!Number.isInteger(track.trackNumber) ||
			track.trackNumber < 1 ||
			track.id == null ||
			ids.has(track.id)
		)
			throw new Error("Album tracks need unique IDs, valid positions and positive durations.");
		if (track.durationMs > SIDE_LIMIT) throw new Error("A track exceeds the 22-minute side limit.");
		ids.add(track.id);
	}
	if (!ids.has(selectedTrackId)) throw new Error("The selected song is missing from the album.");
	const prefix = [0];
	for (const track of ordered) prefix.push(prefix.at(-1) + track.durationMs);
	const total = prefix.at(-1);
	// Above 15 minutes, use at least two sides when there is a track boundary.
	const minimumSides = total > 15 * MINUTE && ordered.length > 1 ? 2 : 1;
	for (let count = minimumSides; count <= ordered.length; count++) {
		const target = total / count;
		const costs = Array.from({ length: count + 1 }, () => Array(ordered.length + 1).fill(Infinity));
		const cuts = Array.from({ length: count + 1 }, () => Array(ordered.length + 1).fill(-1));
		costs[0][0] = 0;
		for (let side = 1; side <= count; side++) {
			for (let end = side; end <= ordered.length; end++) {
				for (let start = end - 1; start >= side - 1; start--) {
					const duration = prefix[end] - prefix[start];
					if (duration > SIDE_LIMIT) break;
					const cost = costs[side - 1][start] + (duration - target) ** 2;
					if (cost < costs[side][end]) {
						costs[side][end] = cost;
						cuts[side][end] = start;
					}
				}
			}
		}
		if (!Number.isFinite(costs[count][ordered.length])) continue;
		const sides = [];
		let end = ordered.length;
		for (let side = count; side > 0; side--) {
			const start = cuts[side][end];
			sides.unshift({
				record: Math.floor((side - 1) / 2) + 1,
				face: side % 2 ? "A" : "B",
				tracks: ordered.slice(start, end),
				durationMs: prefix[end] - prefix[start],
			});
			end = start;
		}
		return {
			recordCount: Math.ceil(count / 2),
			sides,
			selectedSide: sides.findIndex((side) =>
				side.tracks.some((track) => track.id === selectedTrackId),
			),
		};
	}
	throw new Error("Unable to lay out the album.");
}

/** Radii use the reference image's 1024px canvas and centred 752px disc. */
export function getVinylBands(tracks) {
	if (
		!tracks.length ||
		tracks.some((track) => !Number.isFinite(track.durationMs) || track.durationMs <= 0)
	) {
		throw new Error("Groove bands require positive track durations.");
	}
	const outer = 328;
	const inner = 202;
	// Keep many short tracks legible without letting gaps consume the music area.
	const gap = Math.min(3, 30 / Math.max(1, tracks.length - 1));
	const available = outer - inner - gap * (tracks.length - 1);
	const total = tracks.reduce((sum, track) => sum + track.durationMs, 0);
	let radius = outer;
	return tracks.map((track) => {
		const band = {
			trackId: track.id,
			outerRadius: radius,
			innerRadius: radius - (available * track.durationMs) / total,
		};
		radius = band.innerRadius - gap;
		return band;
	});
}

const number = (value) => Number(value.toFixed(3));
const escapeXml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char],
	);

/** Standalone SVG, transparent padding and spindle hole; no embedded raster. */
export function generateVinylSvg(tracks, { title = "Vinyl record" } = {}) {
	const bands = getVinylBands(tracks);
	const circle = (radius, stroke, width) =>
		`<circle cx="512" cy="512" r="${number(radius)}" fill="none" stroke="${stroke}" stroke-width="${number(width)}"/>`;
	const elements = [
		'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img">',
		`<title>${escapeXml(title)}</title>`,
		'<defs><filter id="vinyl-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="17"/><feColorMatrix type="saturate" values="0"/><feComposite in="SourceGraphic" operator="arithmetic" k2="0.98" k3="0.02"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>',
		// Annuli leave a real transparent hole. Keep the outer rim unlit and unfiltered.
		circle(256, "#151515", 240),
		circle(351, "#030303", 11),
		circle(337, "#1b1b1b", 17),
		circle(329, "#070707", 2.5),
		'<g filter="url(#vinyl-grain)">',
	];
	for (const band of bands) {
		const middle = (band.outerRadius + band.innerRadius) / 2;
		elements.push(`<g data-track-id="${escapeXml(band.trackId)}">`);
		elements.push(circle(middle, "#1b1b1b", band.outerRadius - band.innerRadius));
		// Subpixel grooves vary deterministically; no per-render randomness or noise bitmap.
		for (let radius = band.innerRadius + 0.5; radius < band.outerRadius - 0.2; radius += 0.72) {
			const wave = Math.sin(radius * 1.73) * Math.sin(radius * 0.37);
			const tone = Math.round(
				25 + wave * 3 + Math.sin(radius * 0.32) * 3 + Math.sin(radius * 0.081) * 2,
			)
				.toString(16)
				.padStart(2, "0");
			elements.push(circle(radius, `#${tone}${tone}${tone}`, 0.68 + (wave + 1) * 0.06));
		}
		elements.push("</g>");
	}
	for (let i = 0; i < bands.length - 1; i++) {
		const gap = bands[i].innerRadius - bands[i + 1].outerRadius;
		elements.push(circle(bands[i].innerRadius - gap / 2, "#050505", gap));
	}
	elements.push("</g>");
	// Broad quiet run-out, white label, clean dark rim. No edge-lighting artifact.
	elements.push(circle(202, "#050505", 2.7));
	elements.push(circle(138, "#111111", 4));
	elements.push(circle(81, "#ffffff", 110));
	elements.push("</svg>");
	return elements.join("\n");
}
