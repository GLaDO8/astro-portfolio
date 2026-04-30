import { join } from "node:path";
import type { ImageMetadata } from "astro";

const assetModules = import.meta.glob<ImageMetadata>(
	"/src/assets/**/*.{avif,gif,jpeg,jpg,png,svg,webp}",
	{ eager: true, import: "default" },
);

const assetEntries = Object.entries(assetModules).map(([modulePath, image]) => {
	const publicPath = `/${modulePath.replace(/^\/src\/assets\//, "")}`;
	const sourcePath = join(process.cwd(), modulePath.slice(1));

	return [publicPath, { image, sourcePath }] as const;
});

const assetsByPublicPath = new Map<string, ImageMetadata>(
	assetEntries.map(([publicPath, { image }]) => [publicPath, image]),
);

const assetSourcePathsByPublicPath = new Map<string, string>(
	assetEntries.map(([publicPath, { sourcePath }]) => [publicPath, sourcePath]),
);

export function getImageAsset(src?: string | null): ImageMetadata | undefined {
	if (!src) return undefined;
	return assetsByPublicPath.get(src);
}

export function getImageAssetSourcePath(src?: string | null): string | undefined {
	if (!src) return undefined;
	return assetSourcePathsByPublicPath.get(src);
}

export function getRequiredImageAsset(src: string): ImageMetadata {
	const image = getImageAsset(src);

	if (!image) {
		throw new Error(`Missing local image asset for "${src}"`);
	}

	return image;
}
