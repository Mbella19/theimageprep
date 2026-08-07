/**
 * Structured-data builders.
 *
 * Deliberately NOT included anywhere:
 *   - `HowTo`          Google retired the rich result in 2023; emitting it is noise.
 *   - `aggregateRating` We have no reviews. Inventing them is a manual-action risk
 *                       and, more to the point, a lie.
 *
 * `FAQPage` IS included. It no longer earns a rich snippet for a site like this
 * (Google restricted those to authoritative government and health sources), but
 * it is valid markup, it costs nothing, and it describes content genuinely on
 * the page.
 */
import { SITE, absoluteUrl } from '../config';
import type { Faq, Tool } from '../data/tools';

type Schema = Record<string, unknown>;

export interface Crumb {
  name: string;
  path: string;
}

export function organizationSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': absoluteUrl('/') + '#organization',
    name: SITE.name,
    url: absoluteUrl('/'),
    description: SITE.tagline,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/android-chrome-512x512.png'),
      width: 512,
      height: 512,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.email,
      url: absoluteUrl('/contact/'),
    },
  };
}

export function websiteSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/') + '#website',
    name: SITE.name,
    url: absoluteUrl('/'),
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { '@id': absoluteUrl('/') + '#organization' },
  };
}

/**
 * `WebApplication` rather than the broader `SoftwareApplication`: these tools
 * run in the browser and install nothing, and the subtype says so precisely.
 */
export function webApplicationSchema(tool: Tool): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.name,
    url: absoluteUrl(`/${tool.slug}/`),
    description: tool.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any modern web browser',
    browserRequirements: 'Requires JavaScript and WebAssembly',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    permissions: 'No account required. Files are processed locally and never uploaded.',
    publisher: { '@id': absoluteUrl('/') + '#organization' },
  };
}

export function breadcrumbSchema(crumbs: Crumb[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function faqSchema(faqs: Faq[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  path: string;
  published: string;
  updated?: string;
  image?: string;
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: absoluteUrl(opts.path),
    datePublished: opts.published,
    dateModified: opts.updated ?? opts.published,
    inLanguage: SITE.language,
    image: absoluteUrl(opts.image ?? '/og/default.png'),
    author: { '@id': absoluteUrl('/') + '#organization' },
    publisher: { '@id': absoluteUrl('/') + '#organization' },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(opts.path),
    },
  };
}

export function collectionPageSchema(opts: {
  name: string;
  description: string;
  path: string;
  items: { name: string; path: string }[];
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    inLanguage: SITE.language,
    isPartOf: { '@id': absoluteUrl('/') + '#website' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: opts.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}
