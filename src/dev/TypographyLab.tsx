import { DialRoot, useDialKitController } from "dialkit";
import { useEffect, useState } from "react";
import "dialkit/styles.css";
import { isLocalFontAvailable } from "@/dev/localFontPreview.mjs";
import NotesTypographyPanel from "@/dev/NotesTypographyPanel";

export default function TypographyLab() {
	const [status, setStatus] = useState("");
	const controller = useDialKitController(
		"Main font",
		{
			source: {
				type: "select",
				options: [
					{ value: "default", label: "Commissioner (site default)" },
					{ value: "google", label: "Google Fonts" },
					{ value: "local", label: "Installed font" },
				],
				default: "default",
			},
			family: { type: "text", default: "Inter", placeholder: "e.g. Inter or DM Sans" },
			reset: { type: "action", label: "Reset to Commissioner" },
		},
		{
			id: "main-font",
			persist: { key: "main-font:v1" },
			onAction: () => controller.resetValues(),
		},
	);
	const { source, family } = controller.values;

	useEffect(() => {
		// Give Vite's injected stylesheet an ID the existing swap preserver recognizes.
		const stylesheet = document.querySelector<HTMLStyleElement>(
			'style[data-vite-dev-id*="dialkit"]',
		);
		if (stylesheet) stylesheet.id = "dialkit-styles";
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		root.style.removeProperty("--font-preview");
		if (source === "default") {
			setStatus("Using the site's Commissioner font.");
			return;
		}
		const name = family.trim();
		if (!name || !/^[\p{L}\p{N} ._-]+$/u.test(name)) {
			setStatus("Enter a font family name, such as Inter or DM Sans.");
			return;
		}
		let cancelled = false;
		let link: HTMLLinkElement | undefined;
		const font = `"${name}"`;
		setStatus(`Loading ${name}…`);
		const timer = window.setTimeout(async () => {
			try {
				if (source === "google") {
					link = document.createElement("link");
					link.rel = "stylesheet";
					link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;500;600;700&display=swap`;
					await new Promise<void>((resolve, reject) => {
						if (!link) return;
						link.onload = () => resolve();
						link.onerror = () => reject(new Error("Font stylesheet unavailable"));
						document.head.appendChild(link);
					});
					const faces = await document.fonts.load(`400 16px ${font}`);
					if (!faces.length) throw new Error("Font unavailable");
				} else {
					if (!isLocalFontAvailable(name)) throw new Error("Installed family unavailable");
				}
				if (cancelled) return;
				root.style.setProperty("--font-preview", `${font}, var(--font-commissioner), sans-serif`);
				setStatus(`Previewing ${name} across the site.`);
			} catch {
				if (!cancelled)
					setStatus(
						source === "local"
							? `The browser could not find ${name}. Check its family name in Font Book, or restart the browser if it was just installed. Commissioner is still active.`
							: `Could not load ${name}. Check the name and connection. Commissioner is still active.`,
					);
			}
		}, 500);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
			link?.remove();
			root.style.removeProperty("--font-preview");
		};
	}, [source, family]);

	return (
		<aside
			aria-label="Typography playground"
			data-lenis-prevent
			className="fixed top-20 right-4 z-50 max-h-[75dvh] w-80 max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-600 shadow-lg"
			style={{ fontFamily: "system-ui, sans-serif" }}
		>
			<details>
				<summary className="cursor-pointer px-2 py-1 font-semibold">Typography lab</summary>
				<p className="px-2 py-2 leading-relaxed">
					Choose a source, then enter a font family to preview it live. Changes and named presets
					stay in this browser, including after reload. Dev only; source files are unchanged.
				</p>
				<p role="status" className="px-2 py-2 leading-relaxed">
					{status}
				</p>
				{typeof document !== "undefined" && document.querySelector(".notes-prose") ? (
					<NotesTypographyPanel />
				) : null}
				<DialRoot mode="inline" theme="light" />
			</details>
		</aside>
	);
}
