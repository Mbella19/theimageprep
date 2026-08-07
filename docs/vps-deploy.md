# Deploying to a VPS

The site is static. `npm run build` produces `dist/`, and serving that directory
*is* the website — no Node process runs in production, no database, no runtime.

The live site currently runs on Cloudflare Pages ([deploy.md](deploy.md)). These
instructions are the alternative: a plain Linux box you control.

---

## First-time setup

Roughly ten minutes on a fresh Ubuntu/Debian VPS.

### 1. Install Node 20+ and Caddy

```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

**Caddy rather than nginx** because it obtains and renews a Let's Encrypt
certificate by itself. No certbot, no renewal cron job, no certificate quietly
expiring in eighteen months. See [Using nginx instead](#using-nginx-instead) if
you already run one.

### 2. Clone and build

```bash
sudo mkdir -p /var/www && sudo chown "$USER" /var/www
cd /var/www
git clone https://github.com/Mbella19/theimageprep.git theimageprep
cd theimageprep
npm ci
npm run build
```

`npm run build` runs the SEO audit and **fails the build** on a broken canonical,
a dead internal link, a duplicate title or a page missing from the sitemap. If it
exits non-zero, nothing was deployed — read the error rather than working around it.

### 3. Point Caddy at the repo config

```bash
sudo rm -f /etc/caddy/Caddyfile
sudo ln -s /var/www/theimageprep/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

A symlink, not a copy — otherwise `git pull` updates the repo's config and the
running server keeps using a stale one, which is a genuinely confusing failure.

### 4. Point DNS at the box

Two A records at your DNS provider, both to the server's public IP:

| Type | Name | Value |
|---|---|---|
| A | `@` | your VPS IP |
| A | `www` | your VPS IP |

If the domain is behind Cloudflare's proxy, set SSL/TLS mode to **Full (strict)**.
Leaving it on *Flexible* makes Cloudflare talk to your origin over plain HTTP, and
combined with Caddy's HTTP→HTTPS redirect that produces an infinite redirect loop.

Caddy issues the certificate on first request. Give it 30 seconds, then:

```bash
curl -I https://theimageprep.com/
```

---

## Deploying an update

```bash
cd /var/www/theimageprep
./scripts/deploy-vps.sh
```

Pull → `npm ci` → build → reload. Caddy serves `dist/` from disk, so the new
build is live the instant it finishes.

---

## What the Caddyfile does, and why each part matters

Cloudflare Pages reads [`public/_headers`](../public/_headers). **Nothing else does.**
On a VPS that file is inert, so [`deploy/Caddyfile`](../deploy/Caddyfile) restates
everything. Change one, change the other.

Every item below was verified by running this exact config locally and inspecting
the responses:

| Concern | Why it matters |
|---|---|
| `Content-Type: application/wasm` | A wrong type makes `WebAssembly.instantiateStreaming` fail and **every tool breaks**, with nothing in the UI explaining why. nginx only added wasm to its bundled `mime.types` in 1.21 — older builds serve `application/octet-stream`. |
| **Real 404 status** | `dist/404.html` must be served with a `404`, not a `200`. Serving it as 200 creates "soft 404s", which Google treats as a site-wide quality problem. |
| HTML `max-age=0, must-revalidate` | Without it, returning visitors keep the old page until their cache expires and your deploy is invisible. The most common static-hosting mistake, and completely silent. |
| `/_astro/*` one year immutable | Those filenames contain a content hash, so they can be cached forever. The HEIC decoder alone is ~3 MB — this is the difference between a fast repeat visit and a slow one. |
| Icons one day | Icons are stable but **not** content-hashed. A year would strand a changed favicon in every browser cache. |
| `zstd gzip` | The WASM codecs compress to roughly a quarter. MozJPEG's encoder goes 251 KB → 61 KB. |
| Trailing-slash redirect | The site builds with `trailingSlash: 'always'`, so `/compress-jpg` must redirect to `/compress-jpg/` rather than 404. |
| `www` → apex **301** | Every canonical tag points at the apex. Without this, all 35 pages exist at two hostnames competing with each other. |

### Never add COOP/COEP

`Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` unlock
multi-threaded WebAssembly, which is tempting on an image-processing site. Do not
add them:

1. The jSquash codecs here are single-threaded builds and gain nothing.
2. Cross-origin isolation blocks third-party iframes, which breaks AdSense
   completely — and AdSense is the entire business model.

### Never add an ad slot next to the tool controls

Not a server concern, but it lives in the same category of thing that is easy to
break and expensive to fix: Google's ad placement policy prohibits ads adjacent to
action items, and the penalty applies to the whole account.

---

## Using nginx instead

Perfectly workable, but you are responsible for TLS (certbot plus a renewal timer)
and no tested config ships in this repo. If you go that route, the four things that
will actually bite you:

1. `types { application/wasm wasm; }` unless you are on nginx ≥ 1.21.
2. `error_page 404 /404.html;` — verify with `curl -I` that the status is still 404.
3. `location ~* \.html$ { add_header Cache-Control "public, max-age=0, must-revalidate"; }`
   and a separate one-year immutable rule for `/_astro/`.
4. `try_files $uri $uri/ =404;` for directory-style URLs.

Verify with the same checks used on Caddy:

```bash
curl -sI https://theimageprep.com/_astro/<some>.wasm | grep -i content-type   # application/wasm
curl -so /dev/null -w '%{http_code}\n' https://theimageprep.com/does-not-exist  # 404
curl -sI https://theimageprep.com/compress-jpg/ | grep -i cache-control       # max-age=0
curl -sI https://theimageprep.com/compress-jpg  | grep -i location            # 301/308 to trailing slash
```

---

## Cost note

A VPS is not cheaper than Cloudflare Pages for this site — Pages is free with no
bandwidth charge, which is exactly why it was chosen. The reasons to run a VPS are
control, avoiding a dependency on Cloudflare, or already having a box. Bandwidth is
the thing to watch: the HEIC decoder is ~3 MB and a tool page going viral produces
real traffic on a metered host. The one-year immutable caching means repeat visitors
download it once, which is most of the mitigation available.
