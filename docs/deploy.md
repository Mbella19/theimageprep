# Deploying to Cloudflare Pages

The site is fully static. `npm run build` produces `dist/`, and that directory is the
whole website — no server, no database, no runtime.

## Before the first deploy

**Already done.** [`src/config.ts`](../src/config.ts) is set to:

```ts
name:  'The Image Prep',
url:   'https://theimageprep.com',   // apex, no www, no trailing slash
email: 'hello@theimageprep.com',
```

`url` is the important one — it generates every canonical tag, the sitemap, the
`Sitemap:` line in robots.txt and all Open Graph URLs. Pointing it at a domain you do
not own is the single most damaging configuration mistake available here.

If you ever change `name`, run `npm run assets` before `npm run build`: the favicons and
social cards have the brand name rendered into the pixels and will not update on their own.

## Option A — Git-connected (recommended)

Deploys automatically on every push.

1. Push the project to GitHub or GitLab.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
3. Select the repository and configure the build:

   | Setting | Value |
   |---|---|
   | Framework preset | Astro |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | 20 or later (set `NODE_VERSION` = `20` under Environment variables) |

4. **Save and Deploy.**

Because `npm run build` includes the SEO audit, a broken canonical or a dead internal
link fails the deployment rather than shipping.

## Option B — Direct upload

No repository needed, but nothing is automatic.

```bash
npm run build
npx wrangler pages deploy dist --project-name=your-project
```

Or drag the `dist` folder onto the Cloudflare Pages dashboard.

## Custom domain — theimageprep.com

If the domain is not registered at Cloudflare, first move its **nameservers** to
Cloudflare (dashboard → **Add a domain**), then at the current registrar replace the
nameservers with the two Cloudflare gives you. Propagation is usually under an hour.
This is not required, but without it the `www` redirect below needs registrar-side
configuration that varies by provider.

1. Pages project → **Custom domains** → **Set up a domain** → `theimageprep.com`.
2. Repeat for `www.theimageprep.com`. Both must be attached before a redirect can exist.
3. HTTPS issues automatically. **Wait for the certificate before touching Search
   Console** — verifying against a half-provisioned domain fails confusingly.

### Force www → apex

`url` in config is the apex, so `www` must redirect to it rather than serving a second
copy of all 35 pages.

> **A `_redirects` file cannot do this.** Cloudflare Pages matches `_redirects` on the
> **path only** — an absolute-URL source like
> `https://www.example.com/* https://example.com/:splat 301` is Netlify syntax and is
> silently ignored here. It does not error, it does not warn; `www` just keeps returning
> 200. This was tried and confirmed against the live site. Use a zone Redirect Rule.

Cloudflare dashboard → the **domain** (not the Pages project) → **Rules** →
**Redirect Rules** → **Create rule**:

| | |
|---|---|
| When incoming requests match | **Custom filter expression** |
| Field / Operator / Value | `Hostname` · `equals` · `www.theimageprep.com` |
| Then / Type | **Dynamic** |
| Expression | `concat("https://theimageprep.com", http.request.uri.path)` |
| Status code | **301** |
| Preserve query string | on |

A 301 is deliberate — a 302 leaves both hostnames indexable, which is the whole problem
this exists to prevent. Confirm with `curl -I https://www.theimageprep.com/`: expect
`301` and a `location:` on the apex, **not** `200`.

Keep `www` attached as a Pages custom domain. The redirect runs at the edge before Pages
is reached, and the hostname still needs to resolve and complete a TLS handshake for a
browser to ever see the redirect.

## Email

`hello@theimageprep.com` is now printed on `/contact/`, `/privacy-policy/`, `/terms/`
and in the Organization schema. There is no mailbox behind it yet, so it bounces today.

Cloudflare **Email Routing** (dashboard → Email → Email Routing) forwards it to a
personal inbox for free and adds the MX and SPF records itself. Do this before applying
to AdSense: reviewers check that a stated contact address is real, and a bouncing
address on a site asking to run ads is an easy rejection.

## Headers

[`public/_headers`](../public/_headers) is copied into `dist/` and applied automatically.
It sets a one-year immutable cache on hashed build assets and WASM, plus
`X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.

> **Do not add `Cross-Origin-Embedder-Policy` or `Cross-Origin-Opener-Policy`.**
> Cross-origin isolation would allow multi-threaded WebAssembly, which looks attractive
> for an image site, but it blocks third-party iframes and breaks AdSense entirely. The
> codecs used here are single-threaded builds and gain nothing from it.

## Verifying the deployment

```bash
curl -I  https://theimageprep.com/                   # 200, HTTPS
curl -I  https://www.theimageprep.com/               # 301 to the apex
curl -I  https://theimageprep.com/does-not-exist     # 404, not 200
curl -s  https://theimageprep.com/robots.txt         # Sitemap: line on the real domain
curl -s  https://theimageprep.com/sitemap-index.xml  # lists theimageprep.com
curl -sI https://theimageprep.com/favicon.ico        # 200
```

The 404 check matters. Cloudflare Pages serves `dist/404.html` with a genuine 404
status; a misconfigured host returning 200 for missing pages creates "soft 404s", which
Google treats as a quality problem.

Then in a browser:

- Open a tool page, disconnect from the network, and process an image. It should still
  work — that is the privacy claim, and it is worth confirming on the live site.
- Check the page on a phone at 375px wide, especially the crop and watermark tools.
- Run PageSpeed Insights against the homepage, a tool page and a guide.

## Bandwidth and cost

Cloudflare Pages has no bandwidth charge on the free plan, which is why it was chosen:
the WASM codecs are a few hundred kilobytes each and the HEIC decoder is about 3 MB, so
a tool page going viral would produce real traffic on a metered host. Those files are
served with immutable one-year caching, so repeat visitors download them once.

There is a limit of 500 builds per month on the free plan. That is not a constraint for
a site updated weekly.

## Rolling back

Pages keeps every deployment. Dashboard → your project → **Deployments** → find the last
good one → **Rollback**. Instant, and no rebuild required.
