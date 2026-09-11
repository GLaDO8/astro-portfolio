import { useDialKitController } from "dialkit";
import { useState } from "react";
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
			<p className="px-2 py-2 leading-relaxed">
				Notes sizes and spacing are in px; line height is a multiplier and tracking is in em.
				Desktop starts at 768px.
			</p>
			<p role="status" className="px-2 leading-relaxed">
				{status}
			</p>
		</>
	);
}
