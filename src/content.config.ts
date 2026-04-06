import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const notes = defineCollection({
	loader: glob({ pattern: "**/*.mdoc", base: "./src/content/notes" }),
	schema: z.object({
		title: z.string(),
		subtitle: z.string(),
		description: z.string().optional(),
		date: z.date(),
		draft: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
	}),
});

const caseStudies = defineCollection({
	loader: glob({
		pattern: ["hot-text.mdoc"],
		base: "./src/content/case-studies",
	}),
	schema: z.object({
		title: z.string(),
		subtitle: z.string(),
		description: z.string().optional(),
		date: z.date(),
		draft: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
		theme: z.string().optional(),
	}),
});

export const collections = { notes, caseStudies };
