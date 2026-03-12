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
		carousel: {
			render: component("./src/components/mdoc/ImageCarouselWrapper.astro"),
			selfClosing: true,
			attributes: {
				images: { type: String, required: true },
			},
		},
	},
});
