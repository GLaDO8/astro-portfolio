/**
 * Test CSS family resolution. local() requires a full face/PostScript name and
 * can reject installed families such as Inter. Multiple fallback measurements
 * distinguish a resolved family from the browser silently using its fallback.
 * @param {string} name
 * @param {Document} doc
 */
export function isLocalFontAvailable(name, doc = document) {
	const context = doc.createElement("canvas").getContext("2d");
	if (!context) return false;
	const family = JSON.stringify(name);
	const sample = "mmmmWWWWiiii0123456789";
	return ["monospace", "serif", "sans-serif"].some((fallback) => {
		context.font = `48px ${fallback}`;
		const baseline = context.measureText(sample).width;
		context.font = `48px ${family}, ${fallback}`;
		return context.measureText(sample).width !== baseline;
	});
}
