import sharp from "sharp";
import { getImageAssetSourcePath } from "@/lib/imageAssets";

export type ImageEdgeTone = "dark" | "light";

const MAX_SAMPLE_SIZE = 96;
const EDGE_SAMPLE_RATIO = 0.08;
const DARK_EDGE_THRESHOLD = 0.5;
const edgeToneCache = new Map<string, Promise<ImageEdgeTone>>();

export async function getImageEdgeTone(src: string): Promise<ImageEdgeTone> {
	const sourcePath = getImageAssetSourcePath(src);

	if (!sourcePath) {
		return "light";
	}

	let cachedTone = edgeToneCache.get(sourcePath);

	if (!cachedTone) {
		cachedTone = calculateImageEdgeTone(sourcePath);
		edgeToneCache.set(sourcePath, cachedTone);
	}

	return cachedTone;
}

async function calculateImageEdgeTone(sourcePath: string): Promise<ImageEdgeTone> {
	const { data, info } = await sharp(sourcePath)
		.rotate()
		.resize({
			width: MAX_SAMPLE_SIZE,
			height: MAX_SAMPLE_SIZE,
			fit: "inside",
			withoutEnlargement: true,
		})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const edgeWidth = Math.max(1, Math.round(Math.min(info.width, info.height) * EDGE_SAMPLE_RATIO));
	let luminanceTotal = 0;
	let alphaTotal = 0;

	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const isEdgePixel =
				x < edgeWidth ||
				y < edgeWidth ||
				x >= info.width - edgeWidth ||
				y >= info.height - edgeWidth;

			if (!isEdgePixel) continue;

			const index = (y * info.width + x) * info.channels;
			const alpha = data[index + 3] / 255;

			if (alpha < 0.05) continue;

			const luminance = getRelativeLuminance(data[index], data[index + 1], data[index + 2]);

			luminanceTotal += luminance * alpha;
			alphaTotal += alpha;
		}
	}

	if (alphaTotal === 0) {
		return "light";
	}

	return luminanceTotal / alphaTotal < DARK_EDGE_THRESHOLD ? "dark" : "light";
}

function getRelativeLuminance(red: number, green: number, blue: number): number {
	return (
		0.2126 * toLinearChannel(red) + 0.7152 * toLinearChannel(green) + 0.0722 * toLinearChannel(blue)
	);
}

function toLinearChannel(channel: number): number {
	const srgb = channel / 255;

	return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}
