import { DialRoot, useDialKitController } from "dialkit";
import { useState } from "react";
import "dialkit/styles.css";
import { notesTypographyConfig, notesTypographyCss } from "@/dev/notesTypography";

export default function NotesTypographyPanel() {
	const [status, setStatus] = useState("");
	const controller = useDialKitController("Notes typography", notesTypographyConfig, {
		id: "notes-typography",
		persist: { key: "notes-typography:v1" },
		onAction: async (action) => {
			if (action === "reset") {
				controller.resetValues();
				setStatus("Starting values restored and applied live.");
				return;
			}
			const css = notesTypographyCss(controller.getValues());
			if (action === "copyCss") {
				try {
					await navigator.clipboard.writeText(css);
					setStatus("CSS copied. Paste it into your stylesheet when ready to publish.");
				} catch {
					setStatus("Clipboard unavailable. Use Download CSS instead.");
				}
			}
			if (action === "downloadCss") {
				const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
				const link = document.createElement("a");
				link.href = url;
				link.download = "notes-typography.css";
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				setStatus("CSS downloaded. No source files have been changed.");
			}
		},
	});

	return (
		<>
			<style>{notesTypographyCss(controller.values)}</style>
			<aside
				aria-label="Notes typography playground"
				data-lenis-prevent
				className="fixed top-20 right-4 z-50 max-h-[75dvh] w-80 max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-600 shadow-lg"
			>
				<details open>
					<summary className="cursor-pointer px-2 py-1 font-semibold">Typography lab</summary>
					<p className="mb-2 px-2 leading-relaxed">
						Dev only. Changes apply live as you adjust the controls. Sizes and spacing are in px;
						line height is a multiplier, tracking is in em. Desktop starts at 768px. Changes and
						named presets stay in this browser, not your source files.
					</p>
					<DialRoot mode="inline" theme="light" />
					<p role="status" className="px-2 pt-2 leading-relaxed">
						{status}
					</p>
				</details>
			</aside>
		</>
	);
}
