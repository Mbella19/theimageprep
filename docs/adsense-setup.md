# AdSense setup

Ads are **off**. Nothing renders and no Google script loads until you enable them, so
the site launches clean.

## You already have an approved account

This matters, and it changes the advice. Adding a site to an **existing approved
AdSense account** is a different, much lower bar than a first application: Google
reviews the site against its policies, not you as a publisher. There is no
account-level risk in adding a site that gets declined — you fix the reason and
request another review.

The site already satisfies AdSense's structural requirements: original content
across 35 pages, plain-HTML navigation, a working contact route, a privacy
policy and terms.

The one genuine risk is **age**. Reviewers can see a domain registered days ago
with no indexed pages and no traffic, and "low value content" is the catch-all
they reach for. That is not a statement about your content — it is about the
site looking unestablished.

**Recommendation:** add the site and get the verification code live now, but
wait until Search Console shows pages actually indexed before requesting the
review. That is usually one to three weeks. The verification code sitting on the
site during that window does nothing visible and costs nothing.

If you would rather move now, the downside is bounded: a decline, a fix, and a
re-request.

## The three stages

Ads are off by default and the code has three distinct states, which is what
lets you get verified long before any ad renders:

| `enabled` | `client` | `slots` | What happens |
|---|---|---|---|
| `false` | — | — | No Google script at all. The launch state. |
| `true` | set | **empty** | Loader script only. **This is what site review needs.** No ad renders anywhere. |
| `true` | set | filled | Ads render in the reserved placements. |

Stage 2 is the important one: `AdSlot` requires a slot ID before it renders
anything, so a publisher ID with empty `slots` puts the verification tag on
every page while the site stays completely ad-free.

## ads.txt

Generated automatically at `/ads.txt` from your publisher ID — see
[`src/pages/ads.txt.ts`](../src/pages/ads.txt.ts). Nothing to maintain.

It is not optional. Without it AdSense shows a standing "Earnings at risk"
warning, and some buyers skip unauthorised inventory. An ads.txt that exists but
omits your ID is *worse* than none, because the file is treated as exhaustive —
which is exactly why it is derived from `src/config.ts` rather than hand-written.

Check it after deploying:

```bash
curl -s https://theimageprep.com/ads.txt
# google.com, pub-…, DIRECT, f08c47fec0942fa0
```

## Turning ads on

In [`src/config.ts`](../src/config.ts):

```ts
adsense: {
  enabled: true,
  client: 'ca-pub-0000000000000000',   // your publisher ID
  slots: {
    inArticle: '1234567890',
    belowContent: '2345678901',
    footer: '3456789012',
  },
},
```

Create the three ad units in the AdSense dashboard (Ads → By ad unit) and paste each
`data-ad-slot` value in. A placement with a blank slot ID renders nothing, so you can
enable them one at a time.

Rebuild and deploy. Enabling ads **also automatically adds the advertising section to
the privacy policy** — it is conditional on this same flag, so the policy cannot drift
out of sync with what the site actually does.

## Where the slots are, and why

| Placement | Location |
|---|---|
| `inArticle` | On tool pages, after the how-to steps; in guides, after the article body |
| `belowContent` | Above the footer on tool pages, category hubs and the homepage |
| `footer` | Reserved, currently unused |

There are deliberately **no ads on** `/404/` or `/contact/` — Google prohibits ads on
pages without substantial content.

### The rule that protects your account

Google's ad placement policy prohibits ads that *"overlay or are adjacent to
navigational or other action items"*, because they cause accidental clicks. On a tool
site the action items are the dropzone, the process button, the sliders and every
download link.

**Never move an `AdSlot` next to the tool.** Invalid click activity is assessed at the
account level, not the placement level — one greedy layout can end the whole account.
The existing placements are separated from the controls by the entire explanatory
content section. Keep it that way.

The same policy prohibits placements where ads outweigh publisher content on screen.
Two slots per page is the sensible ceiling here.

## Consent management (mandatory for EEA, UK and Switzerland)

Since **16 January 2024**, publishers serving ads to users in the EEA or the UK must use
a **Google-certified Consent Management Platform** integrated with the IAB Transparency
and Consent Framework. Switzerland was added on **31 July 2024**. Without one you are
not eligible to serve personalised ads to those users.

You do not need to buy anything. Google provides a certified CMP free:

1. AdSense → **Privacy & messaging**.
2. Choose **European regulations**.
3. Create the message, select your ad-serving domains, and choose the consent options.
4. Publish.

It appears automatically for visitors in the affected regions. Nothing needs to be added
to this codebase — it is delivered by the AdSense tag that `Base.astro` already loads
when ads are enabled.

If your traffic is largely from those regions, set this up *at the same time* as
enabling ads rather than afterwards.

## Layout shift

Every `AdSlot` reserves its height in CSS before the ad loads
(`min-height` plus `contain: layout` in [`src/styles/global.css`](../src/styles/global.css)).

This is not cosmetic. Ads inserted into unreserved space are the single largest cause of
Cumulative Layout Shift, CLS is a Core Web Vital, and Core Web Vitals feed into how
Google assesses page experience. If you add a new slot, give it a reserved height.

After enabling ads, re-check Core Web Vitals in Search Console. A jump in CLS means a
slot somewhere is not reserving space.

## Checking it worked

1. Deploy, then open a tool page and view source — the `adsbygoogle.js` script should be
   in the `<head>` with your publisher ID.
2. Ads take a few hours to begin serving on a new unit. Blank space at first is normal.
3. Confirm the advertising section is now present on `/privacy-policy/`.
4. Never click your own ads. Not once, not to test. Use AdSense's own preview tools.

## If you are rejected

The rejection email names a category. The two that apply to a site like this:

**"Low value content"** — usually means thin pages or not enough of them. This site
ships 14 substantial tool pages and 8 guides, which is well past the usual bar, so if
this comes back the cause is more likely that the site is too new or has too little
traffic. Publish another guide or two, wait a month, reapply.

**"Site navigation"** — crawlability. Unlikely here: every page is reachable from the
footer with plain HTML links, and the audit fails the build on broken internal links.
Check the live domain resolves correctly and `robots.txt` is not blocking anything.

You can reapply after fixing the issue. Repeatedly reapplying without changing anything
does not help.
