---
title: 'What EXIF Data Reveals About Your Photos'
description: 'Your photos record where they were taken, when, on which camera, and sometimes a copy of the pre-crop image. Here is what is in there.'
h1: 'What EXIF Data Reveals About Your Photos'
blurb: 'Every photo carries a block of hidden information. Some of it is harmless, some of it is your home address, and almost nobody has looked.'
published: '2026-08-07'
relatedTools:
  - remove-exif-data
  - heic-to-jpg
  - compress-jpg
  - change-image-dpi
order: 50
---

## What is actually in there

EXIF — Exchangeable Image File Format — is a block of metadata that cameras and phones write into every photo. It was designed so photographers could review their settings, and it does that well. It also records rather more than most people expect.

- **GPS coordinates.** If location services were enabled, the exact position where the photo was taken, typically accurate to a few metres. Sometimes altitude and compass direction too.
- **Date and time**, to the second.
- **Camera make and model**, and frequently the **body serial number**.
- **Lens model**, aperture, shutter speed, ISO, focal length, flash state.
- **Software** used to edit the file, often with a version number.
- **An embedded thumbnail** — a small copy of the image, which in some editors is not regenerated after a crop.

You can see all of this for one of your own photos using the [EXIF viewer](/remove-exif-data/). It reads the file on your device and shows what is there, including a map link for any coordinates it finds.

## Why the location data matters

This is the one worth being deliberate about, because the failure mode is specific and common.

Somebody photographs an item to sell — on a kitchen table, in a living room, in a garage. The photo goes onto a marketplace listing, or into a message to a buyer, or onto a forum. The file records the coordinates of the room it was taken in. Anyone who obtains that file can read them in seconds with free software.

The same applies to photographs of children posted publicly, to "working from home" shots, and to anything taken at an address you would not publish. The picture does not have to show anything identifying. The coordinates are attached separately.

## The embedded thumbnail problem

This one surprises people. Some editors, when you crop a photo, update the main image but leave the original EXIF thumbnail in place — a small copy of the *uncropped* picture, still inside the file.

The practical consequence is that a crop intended to remove something can leave a recoverable version of what you removed. It is not a hypothetical: it has produced real disclosures. Removing metadata removes the embedded thumbnail along with everything else.

## Do platforms strip it for you?

Some do, some do not, and the behaviour changes without notice — so it is not something to depend on.

**Usually stripped:** the large social platforms. Facebook, Instagram and similar re-encode uploads for their own delivery pipeline, which discards metadata as a side effect.

**Usually not stripped:** email attachments; messaging apps when you send "as file" or "as document" rather than as a photo; cloud storage share links; your own website; and many marketplace listings.

Those second cases are exactly the ones used for selling and client work. The reliable approach is to strip it yourself rather than to guess which pipeline will do it.

## Removing it without wrecking your image

This is where most tools go wrong, and it is worth understanding because the difference is checkable.

An image file is a container: labelled blocks holding the compressed picture data, alongside separate blocks holding metadata. Removing metadata does not require touching the picture at all.

Most online tools remove it by decoding the whole image to pixels and saving a brand new file. That works, but it re-compresses everything — spending a generation of JPEG quality to delete a few kilobytes of text.

The [EXIF remover here](/remove-exif-data/) does it structurally: it copies the compressed picture data across byte for byte and omits the metadata blocks. The pixels that come out are mathematically identical to the pixels that went in. The same applies to PNG, where metadata lives in named chunks, and WebP, where it lives in RIFF chunks.

## Keep the colour profile

One piece of metadata is worth keeping: the ICC colour profile. It tells displays how to interpret your colours. Strip it and images can look washed out or oversaturated on wide-gamut screens — a real, visible cost for a saving of a few kilobytes.

It contains nothing about you. Keep it unless you have a specific reason not to; the tool keeps it by default.

## What removing metadata does not do

Worth stating plainly, because "strip EXIF" is sometimes treated as anonymity.

**The image still shows what it shows.** A recognisable street, a house number, a distinctive view from a window, a reflection — these identify a location far more reliably than coordinates, and no metadata tool touches them.

**Copies already shared are unaffected.** Cleaning your local file changes nothing about a file someone else already has.

What it does is close the easiest route: reading a precise location straight out of a file, automatically, at scale, without anyone having to look at the picture.

## Preventing it at the source

**iPhone:** Settings → Privacy & Security → Location Services → Camera → Never. Photos already taken keep their coordinates.

**Android:** open the Camera app, go into its settings, and turn off location tagging (the wording varies by manufacturer).

Note this only affects new photos, and it is a trade-off — location data is genuinely useful for organising a personal photo library. Many people prefer to leave it on and strip it before sharing, which is what the [remover](/remove-exif-data/) is for.

## HEIC files

iPhone photos in HEIC carry the same metadata, and often more. [Converting them to JPG](/heic-to-jpg/) here decodes the picture and writes a fresh file, so none of the original metadata comes across — the output contains the image and nothing else.
