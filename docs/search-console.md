# Google Search Console and Bing Webmaster Tools

Search Console is the only free source of truth about how the site is actually
performing. Set it up on day one — it only reports data from the moment it is verified,
so a late setup means permanently missing history.

## Verification

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
   and add a property.
2. Choose **Domain** if you can edit DNS (covers every subdomain and both http/https),
   otherwise **URL prefix**.
3. For URL prefix, choose the **HTML tag** method. Copy the value out of the
   `content="..."` attribute — just the token, not the whole tag — and paste it into
   [`src/config.ts`](../src/config.ts):

```ts
verification: {
  google: 'paste-the-content-value-here',
  bing: '',
},
```

4. Rebuild and deploy, then click Verify.

The meta tag is omitted entirely when the value is blank, so there is no stray empty tag
on the site before you set it up.

### Bing

Repeat at [bing.com/webmasters](https://www.bing.com/webmasters). Bing can import
everything directly from Search Console, which takes about a minute. It is worth doing:
Bing also powers DuckDuckGo and a share of ChatGPT's web results, and almost nobody
bothers, so the competition is thinner.

## Submit the sitemap

Search Console → **Sitemaps** → enter:

```
sitemap-index.xml
```

The site generates `sitemap-index.xml`, which points at `sitemap-0.xml`. Both are
regenerated on every build, and `robots.txt` already advertises the index.

Submitting a sitemap helps Google discover your preferred URLs. It does not guarantee
crawling or ranking, and it is not a substitute for internal links — which is why every
page on this site is reachable from the footer.

## What to expect, and when

Google says changes can take anywhere from hours to several months to be reflected.
Realistically, for a brand new domain:

| Timeframe | What normally happens |
|---|---|
| Days 1–7 | Homepage indexed; a handful of pages discovered |
| Weeks 2–4 | Most pages indexed; first impressions appear, positions 30–80 |
| Months 2–3 | Long-tail queries start ranking; the first clicks arrive |
| Months 4–6 | Positions consolidate; competitive terms become reachable |

Nothing about this is fast, and there is no way to pay to accelerate it in organic
results. Do not conclude the site has failed at week three.

## The weekly workflow

Once impressions appear, **Performance → Search results → Queries** becomes your free
keyword research tool. It tells you what people actually typed, rather than what a
keyword tool guessed. Four patterns are worth acting on:

### High impressions, position 8–30

The most valuable signal on the entire report. Google already considers the page
relevant; it is just not winning yet. These are far more productive to improve than
launching something new.

What to do: expand the page to answer the query more completely, work the exact query
wording into the title and an `<h2>`, and add internal links pointing at it from related
pages.

### High impressions, low click-through rate

Google is showing the page and people are not clicking. The ranking is fine; the
snippet is not. Rewrite the `title` and `description` in
[`src/data/tools.ts`](../src/data/tools.ts) to match what the searcher actually wants.
Concrete beats clever — a number or a specific promise outperforms a slogan.

### Several queries circling a feature you do not have

If "compress image to 50kb", "resize to 2000px" and similar keep appearing, the demand
is real and specific. Add the capability, or build a dedicated page for it.

### A page with no impressions after several months

One of three things: the query has no meaningful demand, the page is not indexed (check
**Pages** for the reason), or it is not competitive enough. Check indexing first — it is
the only one you can fix mechanically.

## Reports worth checking monthly

- **Pages** — indexing status and, more usefully, the reasons for exclusions.
- **Core Web Vitals** — should be all-green given the site is static with almost no
  JavaScript on content pages. If it degrades, an ad slot without a reserved height is
  the usual cause.
- **Links** — which pages have earned external links, and which internal pages you are
  linking to most.

## Do not

- **Do not use the URL Inspection "Request indexing" button repeatedly.** It does not
  speed anything up and there is a daily quota.
- **Do not buy backlinks.** It is a link-spam policy violation, and it is the one
  mistake here that can produce a manual action.
- **Do not add pages that are near-duplicates of each other** to chase query variants —
  "image size for gaming channels", "image size for cooking channels" and so on. Google
  classifies substantially similar pages made to target variations as doorway or
  scaled-content abuse. One good page beats fifty thin ones.
