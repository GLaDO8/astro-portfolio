import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";

export interface SongData {
	artist: string;
	title: string;
	album: string;
	albumArt: string;
	previewUrl: string;
	trackUrl: string;
	message: string;
	label: string;
}

export interface PhotoFrameData {
	src: string;
	alt?: string;
}

interface WidgetToml {
	song: {
		url?: string;
		query?: string;
		message: string;
		label: string;
	};
	photoframe: PhotoFrameData;
}

/** Extract ID and country code from an Apple Music URL */
function parseAppleMusicUrl(url: string): {
	id: string;
	country: string;
	isTrack: boolean;
} | null {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		// ?i=1065096755 — track ID param on album URLs
		const trackParam = parsed.searchParams.get("i");
		// Country code is first path segment (e.g. /in/album/...)
		const country =
			segments[0] && /^[a-z]{2}$/i.test(segments[0]) ? segments[0].toLowerCase() : "us";
		if (trackParam) return { id: trackParam, country, isTrack: true };
		// /album/name/ID or /song/name/ID — last path segment
		const last = segments[segments.length - 1];
		if (last && /^\d+$/.test(last)) {
			const isTrack = segments.includes("song");
			return { id: last, country, isTrack };
		}
	} catch {}
	return null;
}

interface iTunesResult {
	artistName: string;
	trackName?: string;
	collectionName: string;
	artworkUrl100: string;
	previewUrl?: string;
	trackViewUrl?: string;
	collectionViewUrl?: string;
}

async function fetchFromiTunes(config: WidgetToml["song"]): Promise<iTunesResult> {
	let apiUrl: string;

	if (config.url) {
		const parsed = parseAppleMusicUrl(config.url);
		if (parsed) {
			apiUrl = `https://itunes.apple.com/lookup?id=${parsed.id}&country=${parsed.country}`;
		} else {
			throw new Error(`Could not parse Apple Music URL: ${config.url}`);
		}
	} else if (config.query) {
		apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(config.query)}&media=music&entity=musicTrack&limit=1`;
	} else {
		throw new Error("widget.toml must have either url or query");
	}

	const res = await fetch(apiUrl);
	const data = await res.json();
	const result = data.results?.[0];
	if (!result) throw new Error(`No iTunes results`);
	return result;
}

function readWidgetToml(): WidgetToml {
	const tomlPath = join(process.cwd(), "widget.toml");
	const tomlContent = readFileSync(tomlPath, "utf-8");
	return parse(tomlContent) as unknown as WidgetToml;
}

export function getWidgetConfig(): WidgetToml {
	return readWidgetToml();
}

export async function getSongData(): Promise<SongData> {
	const config = readWidgetToml();

	const { message, label } = config.song;

	try {
		const result = await fetchFromiTunes(config.song);
		return {
			artist: result.artistName,
			title: result.trackName ?? result.collectionName,
			album: result.collectionName,
			albumArt: result.artworkUrl100.replace("100x100bb", "600x600bb"),
			previewUrl: result.previewUrl ?? "",
			trackUrl: result.trackViewUrl ?? result.collectionViewUrl ?? config.song.url ?? "",
			message,
			label,
		};
	} catch (err) {
		console.warn(`[music] iTunes fetch failed, using fallback:`, err);
		const fallback = config.song.query ?? config.song.url ?? "Unknown";
		return {
			artist: fallback,
			title: "",
			album: "",
			albumArt: "",
			previewUrl: "",
			trackUrl: config.song.url ?? "",
			message,
			label,
		};
	}
}
