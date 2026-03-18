import { component, defineMarkdocConfig } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
	tags: {
		sidenote: {
			render: component("./src/components/mdoc/Sidenote.astro"),
			attributes: {
				caption: { type: Boolean, default: false },
				image: { type: String },
				citation: { type: Boolean, default: false },
			},
		},
		ref: {
			render: component("./src/components/mdoc/Ref.astro"),
			selfClosing: true,
			inline: true,
		},
		imagepair: {
			render: component("./src/components/mdoc/ImagePair.astro"),
			selfClosing: true,
			attributes: {
				src1: { type: String, required: true },
				src2: { type: String, required: true },
				alt1: { type: String },
				alt2: { type: String },
				caption1: { type: String },
				caption2: { type: String },
			},
		},
		marquee: {
			render: component("./src/components/mdoc/ImageMarquee.astro"),
			selfClosing: true,
			attributes: {
				images: { type: String, required: true },
				speed: {
					type: String,
					default: "default",
					matches: ["slow", "default", "fast"],
				},
				direction: {
					type: String,
					default: "left",
					matches: ["left", "right"],
				},
				gap: { type: String, default: "1rem" },
				height: {
					type: String,
					default: "lg",
					matches: ["sm", "md", "lg", "xl"],
				},
			},
		},
		figure: {
			render: component("./src/components/mdoc/Figure.astro"),
			selfClosing: true,
			attributes: {
				src: { type: String, required: true },
				alt: { type: String },
				caption: { type: String },
				width: {
					type: String,
					default: "default",
					matches: ["default", "wide", "full"],
				},
				align: {
					type: String,
					default: "center",
					matches: ["center", "left", "right"],
				},
				maxWidth: { type: String },
			},
		},
	},
});
