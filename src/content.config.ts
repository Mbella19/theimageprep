import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Supporting guides. Each one exists to answer a specific search that a tool
 * page cannot answer well on its own, and each links to the tools it relates to.
 *
 * `relatedTools` holds slugs from src/data/tools.ts and is validated at build
 * time by the SEO audit, so a typo becomes a build failure rather than a
 * silently broken internal link.
 */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    /** <title>, max 60 characters */
    title: z.string().max(60),
    /** meta description, max 155 characters */
    description: z.string().max(155),
    /** Page <h1>. Usually shorter and more natural than the <title>. */
    h1: z.string(),
    /** One-sentence intro shown under the h1 */
    blurb: z.string(),
    published: z.string(),
    updated: z.string().optional(),
    /** Tool slugs this guide should link to */
    relatedTools: z.array(z.string()).default([]),
    /** Ordering on the /guides/ index — lower shows first */
    order: z.number().default(100),
  }),
});

export const collections = { guides };
