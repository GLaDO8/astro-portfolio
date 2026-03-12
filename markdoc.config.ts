import { component, defineMarkdocConfig } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
	tags: {
		sidenote: {
			render: component("./src/components/Sidenote.astro"),
			attributes: {
				caption: { type: Boolean, default: false },
				image: { type: String },
				citation: { type: Boolean, default: false },
			},
		},
		ref: {
			render: component("./src/components/Ref.astro"),
			selfClosing: true,
			inline: true,
		},
	},
});
