import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "smol-toml";

export interface SongData {
	artist: string;
	title: string;
	album: string;
	albumArt: string;
	message: string;
	label: string;
}

interface MusicToml {
	song: {
		url?: string;
		query?: string;
		message: string;
		label: string;
	};
}

/** Extract iTunes track ID from an Apple Music URL (the ?i= param or /album/name/ID pattern) */
function extractTrackId(url: string): string | null {
	try {
		const parsed = new URL(url);
		// ?i=1065096755 — track ID param on album URLs
		const trackParam = parsed.searchParams.get("i");
		if (trackParam) return trackParam;
		// /album/name/ID or /song/name/ID — last path segment
		const segments = parsed.pathname.split("/").filter(Boolean);
		const last = segments[segments.length - 1];
		if (last && /^\d+$/.test(last)) return last;
	} catch {}
	return null;
}

async function fetchFromiTunes(config: MusicToml["song"]): Promise<{
	artistName: string;
	trackName: string;
	collectionName: string;
	artworkUrl100: string;
}> {
	let apiUrl: string;

	if (config.url) {
		const trackId = extractTrackId(config.url);
		if (trackId) {
			apiUrl = `https://itunes.apple.com/lookup?id=${trackId}`;
		} else {
			throw new Error(`Could not extract track ID from URL: ${config.url}`);
		}
	} else if (config.query) {
		apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(config.query)}&media=music&entity=musicTrack&limit=1`;
	} else {
		throw new Error("widget.toml must have either url or query");
	}

	const res = await fetch(apiUrl);
	const data = await res.json();
	const track = data.results?.[0];
	if (!track) throw new Error(`No iTunes results`);
	return track;
}

export async function getSongData(): Promise<SongData> {
	const tomlPath = join(process.cwd(), "widget.toml");
	const tomlContent = readFileSync(tomlPath, "utf-8");
	const config = parse(tomlContent) as unknown as MusicToml;

	const { message, label } = config.song;

	try {
		const track = await fetchFromiTunes(config.song);
		return {
			artist: track.artistName,
			title: track.trackName,
			album: track.collectionName,
			albumArt: track.artworkUrl100.replace("100x100bb", "600x600bb"),
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
			message,
			label,
		};
	}
}
