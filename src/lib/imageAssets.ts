import type { ImageMetadata } from "astro";

const assetModules = import.meta.glob<{ default: ImageMetadata }>(
	"/src/assets/**/*.{avif,gif,jpeg,jpg,png,svg,webp}",
	{ eager: true, import: "default" },
);

const assetsByPublicPath = new Map<string, ImageMetadata>(
	Object.entries(assetModules).map(([modulePath, image]) => [
		`/${modulePath.replace(/^\/src\/assets\//, "")}`,
		image,
	]),
);

export function getImageAsset(src?: string | null): ImageMetadata | undefined {
	if (!src) return undefined;
	return assetsByPublicPath.get(src);
}

export function getRequiredImageAsset(src: string): ImageMetadata {
	const image = getImageAsset(src);

	if (!image) {
		throw new Error(`Missing local image asset for "${src}"`);
	}

	return image;
}
