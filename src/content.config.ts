import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const notes = defineCollection({
	loader: glob({ pattern: "**/*.mdoc", base: "./src/content/notes" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.date(),
		draft: z.boolean().default(false),
	}),
});

const caseStudies = defineCollection({
	loader: glob({
		pattern: ["hot-text.mdoc", "labelling.mdoc", "one-more-whistle.mdoc"],
		base: "./src/content/case-studies",
	}),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.date(),
		theme: z.string().optional(),
	}),
});

export const collections = { notes, caseStudies };
