import { component, defineMarkdocConfig, Markdoc, nodes } from "@astrojs/markdoc/config";
import type { Config, Node } from "@markdoc/markdoc";

const figureComponent = component("./src/components/mdoc/Figure.astro");

function getStandaloneImageNode(node: Node) {
	const [inlineNode] = node.children;

	if (node.children.length !== 1 || inlineNode?.type !== "inline") {
		return undefined;
	}

	const [imageNode] = inlineNode.children;

	if (inlineNode.children.length !== 1 || imageNode?.type !== "image") {
		return undefined;
	}

	return imageNode;
}

function renderParagraph(node: Node, config: Config) {
	const imageNode = getStandaloneImageNode(node);

	if (imageNode) {
		const { src, alt, title } = imageNode.transformAttributes(config);
		const render = config.nodes?.paragraph?.render;

		return new Markdoc.Tag(render as unknown as string, {
			src,
			alt,
			caption: title,
			width: "wide",
		});
	}

	return new Markdoc.Tag("p", node.transformAttributes(config), node.transformChildren(config));
}

export default defineMarkdocConfig({
	nodes: {
		paragraph: {
			...nodes.paragraph,
			// Astro swaps component configs for real components only from schema render targets.
			// Regular paragraphs still render as <p> in renderParagraph.
			render: figureComponent,
			transform: renderParagraph,
		},
		link: {
			render: "a",
			children: ["strong", "em", "s", "code", "text", "tag"],
			attributes: {
				href: { type: String, required: true },
				title: { type: String },
				target: { type: String, default: "_blank" },
				rel: { type: String, default: "noopener noreferrer" },
			},
		},
		fence: {
			render: component("./src/components/mdoc/CodeBlock.astro"),
			attributes: {
				content: { type: String, required: true },
				language: { type: String },
				maxHeight: { type: String },
			},
		},
	},
	tags: {
		accordion: {
			render: component("./src/components/mdoc/Accordion.astro"),
			attributes: {
				title: { type: String, required: true },
				subtitle: { type: String },
			},
		},
		sidenote: {
			render: component("./src/components/mdoc/Sidenote.astro"),
			attributes: {
				caption: { type: Boolean, default: false },
				image: { type: String },
				imageAlt: { type: String },
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
		lottie: {
			render: component("./src/components/mdoc/Lottie.astro"),
			selfClosing: true,
			attributes: {
				src: { type: String, required: true },
				label: { type: String },
				caption: { type: String },
				width: {
					type: String,
					default: "wide",
					matches: ["default", "wide", "full"],
				},
				align: {
					type: String,
					default: "center",
					matches: ["center", "left", "right"],
				},
				maxWidth: { type: String },
				aspectRatio: {
					type: String,
					default: "video",
					matches: ["video", "square"],
				},
				loop: { type: Boolean, default: true },
				autoplay: { type: Boolean, default: true },
				controls: { type: Boolean, default: true },
			},
		},
		figure: {
			render: figureComponent,
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
