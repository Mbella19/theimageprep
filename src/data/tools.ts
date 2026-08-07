/**
 * THE TOOL REGISTRY — single source of truth for every tool page.
 *
 * Titles, meta descriptions, breadcrumbs, structured data, category hubs,
 * related-tool links, the homepage grid and the sitemap are all generated from
 * this file. Adding a tool here plus one page file wires it into everything.
 *
 * Constraints enforced by `scripts/audit-seo.mjs` after each build:
 *   - `title`       unique, <= 60 characters
 *   - `description` unique, 70-155 characters
 *   - `related`     must reference slugs that exist
 */

export type CategoryId = 'compress' | 'convert' | 'resize' | 'metadata' | 'generate';

export interface Faq {
  q: string;
  a: string;
}

export interface Tool {
  /** URL slug. Page lives at /{slug}/ */
  slug: string;
  /** Short label for nav, cards and breadcrumbs */
  name: string;
  /** Page <h1> */
  h1: string;
  /** <title> — max 60 chars */
  title: string;
  /** <meta name="description"> — max 155 chars */
  description: string;
  /** One or two sentences directly under the h1 */
  blurb: string;
  category: CategoryId;
  /** Slugs of 3-4 closely related tools */
  related: string[];
  /** How-to steps rendered as an ordered list */
  steps: string[];
  /** Honest limits. Being upfront here is a deliberate trust signal. */
  limits: string[];
  faqs: Faq[];
}

export interface Category {
  id: CategoryId;
  /** URL slug. Hub page lives at /{slug}/ */
  slug: string;
  name: string;
  h1: string;
  title: string;
  description: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'compress',
    slug: 'compress',
    name: 'Compress',
    h1: 'Image Compression Tools',
    title: 'Compress Images – JPG, PNG and WebP Compressors',
    description:
      'Free image compressors for JPG, PNG and WebP. Set an exact target file size or tune quality by hand. Everything runs in your browser.',
    blurb:
      'Make image files smaller without making them look worse. Each compressor lets you aim at an exact file size, which is what listing limits and upload caps actually require.',
  },
  {
    id: 'convert',
    slug: 'convert',
    name: 'Convert',
    h1: 'Image Format Converters',
    title: 'Convert Images – PNG, JPG, WebP and HEIC',
    description:
      'Convert between PNG, JPG, WebP and HEIC in your browser. Batch conversion, correct colour handling, and no files are ever uploaded.',
    blurb:
      'Change an image from one format to another. Useful when a marketplace rejects your file type, or when you want the smaller file a modern format gives you.',
  },
  {
    id: 'resize',
    slug: 'resize',
    name: 'Resize & Crop',
    h1: 'Resize and Crop Tools',
    title: 'Resize and Crop Images – Exact Dimensions, Free',
    description:
      'Resize, crop and reframe images to exact pixel dimensions or platform presets. High quality Lanczos scaling, batch support, no upload.',
    blurb:
      'Get an image to the exact dimensions a platform asks for, whether that is a 2000 x 2000 Etsy listing photo or a 1280 x 720 YouTube thumbnail.',
  },
  {
    id: 'metadata',
    slug: 'metadata',
    name: 'Metadata',
    h1: 'Image Metadata Tools',
    title: 'Image Metadata Tools – EXIF and DPI Editing',
    description:
      'Inspect and edit the hidden data inside your images. Remove EXIF and GPS, or change DPI, without re-compressing a single pixel.',
    blurb:
      'Every photo carries hidden data: camera model, timestamp, sometimes the exact GPS coordinates where it was taken. These tools let you see it and change it.',
  },
  {
    id: 'generate',
    slug: 'generate',
    name: 'Generate',
    h1: 'Image Generators',
    title: 'Image Generators – Favicons and Social Sizes',
    description:
      'Generate complete icon and image sets from a single file. Favicon packs for websites, and correctly sized images for every social platform.',
    blurb:
      'Turn one source image into the full set of files a website or social profile needs, correctly sized and ready to upload.',
  },
];

export const TOOLS: Tool[] = [
  // ───────────────────────────── COMPRESS ─────────────────────────────
  {
    slug: 'compress-jpg',
    name: 'Compress JPG',
    h1: 'Compress JPG Images',
    title: 'Compress JPG – Reduce JPEG File Size in Your Browser',
    description:
      'Compress JPG and JPEG photos to an exact target size like 100KB or 2MB, or set quality by hand. Runs in your browser, images are never uploaded.',
    blurb:
      'Shrink JPEG files to a target size such as 100 KB or 2 MB, or dial in the quality by hand. Compression happens on your own device, so nothing is uploaded and there is no queue to wait in.',
    category: 'compress',
    related: ['compress-png', 'jpg-to-webp', 'resize-image', 'remove-exif-data'],
    steps: [
      'Drop one or more JPG files onto the box above, or click to browse.',
      'Choose Target size if you need to fit under a specific limit, or Quality if you would rather judge it by eye.',
      'Compare the before and after preview by dragging the divider.',
      'Download the compressed files individually, or all together as a ZIP.',
    ],
    limits: [
      'JPEG is a lossy format. Every save discards some detail permanently, so always compress from your original rather than from an already-compressed copy.',
      'Very small target sizes on large images will produce visible blocking. The tool will warn you when it cannot reach a target without heavy damage.',
      'Compressing an image that is already heavily compressed may barely shrink it, or occasionally grow it slightly. The tool keeps the original if the result is larger.',
    ],
    faqs: [
      {
        q: 'Are my photos uploaded anywhere?',
        a: 'No. The compression runs inside your browser using WebAssembly. Your files never travel across the network. You can prove it: load this page, disconnect from the internet, and compress an image — it still works.',
      },
      {
        q: 'How small can I make a JPG before it looks bad?',
        a: 'For a typical photograph, quality 75-85 is visually indistinguishable from the original for most people while cutting file size by 50-70%. Below quality 60 you will start seeing soft blocks in skies and smooth gradients. Images with text or sharp graphics show damage much earlier — those are usually better as PNG or WebP.',
      },
      {
        q: 'What does Target size actually do?',
        a: 'It repeatedly re-encodes the image at different quality settings, narrowing in on the highest quality that still fits under your byte limit. It usually finds the answer in six to eight attempts. Most free compressors only give you a quality slider, which means guessing repeatedly when you have a hard limit to meet.',
      },
      {
        q: 'Why is my compressed file bigger than the original?',
        a: 'Because the original was already compressed harder than the setting you chose. If you ask for quality 90 on a file that was saved at quality 60, re-encoding adds data back without adding detail. This tool detects that and keeps the smaller original instead.',
      },
      {
        q: 'Does compressing twice make an image worse?',
        a: 'Yes. JPEG compression is lossy and the damage accumulates, a process called generation loss. Each round of decode and re-encode also shifts the 8x8 block boundaries slightly, which compounds the artefacts. Always start from the highest quality original you have.',
      },
      {
        q: 'Will this rotate my iPhone photos sideways?',
        a: 'No. Photos from phones store their orientation as a separate EXIF tag rather than rotating the pixels. Many online tools ignore that tag and output a sideways image. This tool reads the orientation and bakes the correct rotation into the output.',
      },
    ],
  },
  {
    slug: 'compress-png',
    name: 'Compress PNG',
    h1: 'Compress PNG Images',
    title: 'Compress PNG – Lossless and Lossy PNG Compression',
    description:
      'Shrink PNG files with lossless optimisation, or reduce colours for much smaller images. Transparency is kept and nothing leaves your device.',
    blurb:
      'Two ways to shrink a PNG: lossless optimisation that keeps every pixel exactly as it was, or colour reduction that typically cuts file size by 60-80%. Transparency survives both.',
    category: 'compress',
    related: ['compress-jpg', 'png-to-jpg', 'compress-webp', 'resize-image'],
    steps: [
      'Drop your PNG files onto the box above.',
      'Pick Lossless to keep every pixel identical, or Reduce colours for a much smaller file.',
      'If you chose colour reduction, adjust the colour count and watch the preview until the quality is acceptable.',
      'Download the results individually or as a ZIP.',
    ],
    limits: [
      'Lossless mode typically saves 10-30%. If you need dramatic savings you have to use colour reduction, which does change the image.',
      'Colour reduction works beautifully on logos, screenshots, icons and flat illustrations. It works poorly on photographs, which are better served as JPG or WebP.',
      'A photograph saved as PNG will almost always be far larger than the same photograph as JPG, no matter how hard you optimise it.',
    ],
    faqs: [
      {
        q: 'What is the difference between the two modes?',
        a: 'Lossless mode reorganises how the file stores its data, finding a more efficient encoding of exactly the same pixels. The output is pixel-for-pixel identical to the input. Colour reduction rebuilds the image using a smaller palette, typically 256 colours or fewer, which is a much bigger saving but does alter the image.',
      },
      {
        q: 'Why is lossless PNG compression only saving 15%?',
        a: 'That is normal and it is the honest ceiling. Tools that advertise 70% savings on PNG are almost always doing colour reduction and calling it compression. This tool separates the two so you know which one you are getting.',
      },
      {
        q: 'Does transparency survive compression?',
        a: 'Yes, in both modes. Lossless mode preserves the alpha channel exactly. Colour reduction preserves alpha too, including partial transparency such as soft shadows and anti-aliased edges.',
      },
      {
        q: 'Should my photo be a PNG at all?',
        a: 'Usually not. PNG is designed for graphics with flat areas of colour and hard edges: logos, screenshots, diagrams, illustrations, anything needing transparency. For photographs, JPG or WebP will be several times smaller at the same visible quality.',
      },
      {
        q: 'What is dithering and should I turn it on?',
        a: 'When colours are reduced, smooth gradients turn into visible bands. Dithering scatters pixels between two nearby colours to fake the missing shades, which hides the banding at the cost of a slightly larger file. Turn it on for anything with gradients or soft shadows, and off for flat graphics where it just adds noise.',
      },
    ],
  },
  {
    slug: 'compress-webp',
    name: 'Compress WebP',
    h1: 'Compress WebP Images',
    title: 'Compress WebP – Make WebP Files Smaller, Free',
    description:
      'Compress WebP images with adjustable quality or lossless mode. Batch process many files at once, entirely in your browser with no upload.',
    blurb:
      'Reduce the size of WebP images with quality control or lossless optimisation. WebP is already efficient, so use this when you need to squeeze a bit more out of files for a fast website.',
    category: 'compress',
    related: ['compress-jpg', 'compress-png', 'jpg-to-webp', 'resize-image'],
    steps: [
      'Drop your WebP files onto the box above.',
      'Choose lossy quality, or switch on lossless if the image is a graphic with hard edges.',
      'Check the preview, then adjust until the size and quality balance suits you.',
      'Download individually or as a ZIP.',
    ],
    limits: [
      'WebP is already a well-compressed format, so gains are smaller than you would see compressing a PNG or an unoptimised JPG.',
      'Re-compressing a lossy WebP loses quality again, the same way re-saving a JPG does.',
      'WebP files do not carry DPI information, so print resolution cannot be set on them.',
    ],
    faqs: [
      {
        q: 'When should I use lossless WebP instead of lossy?',
        a: 'Use lossless for logos, screenshots, icons, line art and anything containing text. Lossy WebP smears sharp edges the same way JPEG does. For photographs, lossy WebP at quality 75-85 is dramatically smaller and looks the same.',
      },
      {
        q: 'Is WebP supported everywhere now?',
        a: 'Yes, in every current browser, and it has been for years. The remaining friction is desktop software and marketplaces: some older photo editors and some seller platforms still reject WebP uploads, so keep a JPG copy for those.',
      },
      {
        q: 'How much smaller is WebP than JPEG?',
        a: 'For photographs, typically 25-35% smaller at matched visual quality. For graphics with transparency, lossless WebP is usually around 25% smaller than an optimised PNG.',
      },
      {
        q: 'Does WebP support transparency?',
        a: 'Yes, in both lossy and lossless modes, which is one of its main advantages over JPEG. That means a photo with a soft transparent edge can be a single small WebP rather than a large PNG.',
      },
    ],
  },

  // ───────────────────────────── CONVERT ─────────────────────────────
  {
    slug: 'png-to-jpg',
    name: 'PNG to JPG',
    h1: 'Convert PNG to JPG',
    title: 'PNG to JPG Converter – Free, No Upload Needed',
    description:
      'Convert PNG images to JPG in your browser. Choose the background colour that replaces transparency and set the quality. Nothing is uploaded.',
    blurb:
      'Turn PNG files into JPGs, with control over the quality and over which colour replaces any transparent areas. Useful when a marketplace or printer will not accept PNG.',
    category: 'convert',
    related: ['jpg-to-webp', 'compress-jpg', 'compress-png', 'resize-image'],
    steps: [
      'Drop your PNG files onto the box above.',
      'Pick the background colour that will replace transparency. White is the default and is what most marketplaces expect.',
      'Set the JPEG quality, or use a target file size if you have a limit to meet.',
      'Download the converted files.',
    ],
    limits: [
      'JPG cannot store transparency. Any transparent area must be filled with a solid colour, and that choice cannot be undone afterwards.',
      'JPG is lossy, so converting a crisp PNG screenshot to JPG will soften text and sharp edges. Keep screenshots as PNG or WebP where you can.',
      'The conversion cannot recover detail. A blurry PNG becomes a blurry JPG.',
    ],
    faqs: [
      {
        q: 'What happens to the transparent parts of my PNG?',
        a: 'They get filled with the background colour you choose, because JPG has no way to store transparency. White is the default since that is what Amazon, eBay and most print services expect. If your image will sit on a coloured page, match that colour instead or you will see a white box around it.',
      },
      {
        q: 'Why would I convert PNG to JPG at all?',
        a: 'Three common reasons: the file is a photograph and JPG will be several times smaller, a marketplace or printer only accepts JPG, or a system has an upload size limit your PNG exceeds. For graphics and screenshots, staying with PNG usually gives a better result.',
      },
      {
        q: 'Will the JPG look worse than the PNG?',
        a: 'For a photograph at quality 85 or above, no visible difference for most people. For a screenshot, logo or anything with text, yes — you will see faint halos around sharp edges, because JPEG compression is designed for photographic detail rather than hard lines.',
      },
      {
        q: 'Can I convert JPG back to PNG later?',
        a: 'You can, but it will not restore anything. The detail lost during JPEG compression is gone permanently, and the transparency is gone too. Converting back just produces a larger file containing the same damaged image.',
      },
    ],
  },
  {
    slug: 'jpg-to-webp',
    name: 'JPG to WebP',
    h1: 'Convert JPG to WebP',
    title: 'JPG to WebP Converter – Smaller Files, Same Look',
    description:
      'Convert JPG photos to WebP and typically cut file size by 25-35% at the same visual quality. Batch conversion in your browser, no upload.',
    blurb:
      'Convert JPEG photos to WebP, the format that gives you the same visual quality in a noticeably smaller file. The single easiest win for a faster website.',
    category: 'convert',
    related: ['png-to-jpg', 'compress-webp', 'compress-jpg', 'resize-image'],
    steps: [
      'Drop your JPG files onto the box above. Whole folders work too.',
      'Choose a quality level. 80 is a good default for photographs.',
      'Review the size saving reported for each file.',
      'Download the WebP files individually or as a single ZIP.',
    ],
    limits: [
      'This is a lossy to lossy conversion, so a little quality is lost in the round trip. Convert from your highest quality original where possible.',
      'Some marketplaces and older desktop applications still reject WebP uploads. Keep your JPGs for those.',
      'WebP does not carry DPI metadata, so print resolution settings do not survive the conversion.',
    ],
    faqs: [
      {
        q: 'How much smaller will my files actually get?',
        a: 'For typical photographs, expect 25-35% smaller at matched visual quality. The saving is larger for images with smooth areas like skies or studio backdrops, and smaller for busy, highly detailed scenes.',
      },
      {
        q: 'Will WebP work on my website?',
        a: 'Yes. Every current browser supports WebP and has for years. If you need to support genuinely ancient browsers, serve both using a picture element with the WebP first and the JPG as a fallback.',
      },
      {
        q: 'Does Google prefer WebP for SEO?',
        a: 'Google has no preference for the format itself. What matters is that smaller files load faster, and loading speed is part of Core Web Vitals, which is a ranking signal. WebP helps indirectly by making pages faster.',
      },
      {
        q: 'Should I use WebP for my Etsy or Amazon listings?',
        a: 'No. Marketplaces almost all require JPG or PNG for listing photos. WebP is for your own website, blog or portfolio, where you control the hosting.',
      },
      {
        q: 'What quality setting should I choose?',
        a: 'Start at 80. WebP quality numbers are not directly comparable to JPEG quality numbers — WebP at 80 generally looks like JPEG at around 85-90. Drop to 70 for thumbnails and images that display small.',
      },
    ],
  },
  {
    slug: 'heic-to-jpg',
    name: 'HEIC to JPG',
    h1: 'Convert HEIC to JPG',
    title: 'HEIC to JPG – Convert iPhone Photos, Free',
    description:
      'Convert iPhone HEIC photos to JPG in your browser. Handles whole albums, fixes sideways rotation and leaves GPS location data behind.',
    blurb:
      'Convert the HEIC photos your iPhone produces into JPGs that everything can open. Whole albums at once, the right way up, and with the embedded location data left behind.',
    category: 'convert',
    related: ['compress-jpg', 'remove-exif-data', 'resize-image', 'png-to-jpg'],
    steps: [
      'Drop your .heic or .heif files onto the box above. You can select a whole album at once.',
      'Choose a JPEG quality, or set a target file size if you have a limit to meet.',
      'Wait for the conversion. The decoder loads on first use, so the first file takes a moment longer.',
      'Download the JPGs individually or all together as a ZIP.',
    ],
    limits: [
      'The HEIC decoder is a large WebAssembly module, around three megabytes. It downloads once on first use and is then cached.',
      'Camera details, timestamps and GPS coordinates are not carried into the JPG. For most people converting phone photos that is the desired outcome, but if you need the original capture data, keep the HEIC file too.',
      'Live Photos convert as the still frame only. The attached video is not extracted.',
      'A few HEIC files use encoding features the decoder does not cover. If a file fails, opening it on a Mac and exporting to JPG will always work.',
      'Depth maps and portrait-mode blur data are not preserved, since JPG has nowhere to store them.',
    ],
    faqs: [
      {
        q: 'Why does my iPhone save photos as HEIC?',
        a: 'HEIC stores the same picture in roughly half the space of a JPEG, so more photos fit on the phone. The trade-off is compatibility: many websites, Windows applications and marketplace upload forms still cannot read it.',
      },
      {
        q: 'How do I stop my iPhone making HEIC files in the first place?',
        a: 'Settings, then Camera, then Formats, and choose Most Compatible. Your phone will save JPEGs from that point on. Photos already taken stay as HEIC, which is what this tool is for.',
      },
      {
        q: 'Does the converted photo still contain my location?',
        a: 'No. HEIC files from a phone usually carry GPS coordinates accurate to within a few metres, along with the date, time and camera details. Converting here decodes the picture and writes a fresh JPG, so none of that comes across — the output contains the image and nothing else. If you want to see what your original file was revealing, the EXIF viewer will show you before you decide what to share.',
      },
      {
        q: 'Why do some converted photos come out sideways in other tools?',
        a: 'Phones record orientation as a metadata tag instead of rotating the stored pixels. Tools that ignore the tag output a sideways image. This converter reads the tag and rotates the pixels properly, so the JPG is upright everywhere.',
      },
      {
        q: 'Can I convert hundreds of photos at once?',
        a: 'Yes. Conversion is spread across several background threads and the results are bundled into a ZIP. Very large batches will use a lot of memory, so if your browser tab runs out, work in groups of fifty or so.',
      },
    ],
  },

  // ───────────────────────────── RESIZE ─────────────────────────────
  {
    slug: 'resize-image',
    name: 'Resize Image',
    h1: 'Resize an Image',
    title: 'Resize Image – Set Exact Pixel Dimensions',
    description:
      'Resize images to exact pixels, a percentage or a platform preset. Sharp Lanczos scaling, batch support, and nothing is ever uploaded.',
    blurb:
      'Resize to an exact pixel size, a percentage, or a ready-made preset for the platform you are uploading to. Uses high quality Lanczos scaling, so downsized images stay sharp.',
    category: 'resize',
    related: ['crop-image', 'social-media-image-sizes', 'compress-jpg', 'change-image-dpi'],
    steps: [
      'Drop one or more images onto the box above.',
      'Enter the width and height you need, or pick a platform preset such as 1080 x 1350 for an Instagram portrait post.',
      'Choose how to handle a mismatched aspect ratio: fit inside, fill and crop, or stretch.',
      'Download the resized images.',
    ],
    limits: [
      'Enlarging an image cannot invent detail that was never captured. Going much beyond 200% will look soft no matter which algorithm is used.',
      'Stretch mode distorts the picture. It is included because occasionally you genuinely need it, but fit or fill is almost always the right choice.',
      'Resizing re-encodes the file, so a JPG loses a small amount of quality in the process. Resize once from the original rather than repeatedly.',
    ],
    faqs: [
      {
        q: 'What is the difference between fit, fill and stretch?',
        a: 'Fit scales the whole image until it sits inside your target box, which may leave empty space at the edges. Fill scales until the box is completely covered and crops the overflow, so nothing is distorted but some of the edges are lost. Stretch forces the image to the exact dimensions and squashes it. Fill is usually what you want for social media, fit for product photos where nothing may be cut off.',
      },
      {
        q: 'Why does my resized image look soft?',
        a: 'Two common causes. Either you enlarged it, in which case the detail simply is not there to show, or you resized down by a very large factor in one step. This tool uses Lanczos3 resampling, which handles large reductions well, but starting from a bigger original always gives a better result.',
      },
      {
        q: 'Does resizing change the file size?',
        a: 'Yes, substantially. File size scales roughly with the number of pixels, so halving both the width and the height leaves you with a quarter of the pixels and usually something close to a quarter of the file size. Resizing is often more effective than compression for hitting an upload limit.',
      },
      {
        q: 'Should I resize before or after compressing?',
        a: 'Resize first, then compress. Compressing a large image and then shrinking it wastes the compression work and gives a worse result than doing it the other way round.',
      },
      {
        q: 'What does the lock icon next to the dimensions do?',
        a: 'It keeps the aspect ratio fixed, so typing a width automatically calculates the matching height. Unlock it only when you intend to change the proportions of the image.',
      },
    ],
  },
  {
    slug: 'crop-image',
    name: 'Crop Image',
    h1: 'Crop an Image to Exact Dimensions',
    title: 'Crop Image to Exact Dimensions – Free Tool',
    description:
      'Crop any image to exact pixel dimensions or a fixed aspect ratio. Drag to position, see the output size live, and download without uploading.',
    blurb:
      'Crop to an exact pixel size or a locked aspect ratio. Drag the frame to choose what stays in shot, and watch the output dimensions update as you go.',
    category: 'resize',
    related: ['resize-image', 'profile-picture-maker', 'social-media-image-sizes', 'compress-jpg'],
    steps: [
      'Drop an image onto the box above.',
      'Enter the exact output size you need, or choose an aspect ratio such as 1:1 or 16:9 to lock the frame shape.',
      'Drag the crop frame to position it, and drag its corners to resize.',
      'Download the cropped image.',
    ],
    limits: [
      'Cropping removes pixels. If you crop a small area out of a small image, the result will be small — this tool will not upscale it for you unless you ask.',
      'One image at a time. Batch cropping many different photos to the same frame rarely produces good results, because the subject sits in a different place in each one.',
      'Cropping a JPG re-encodes it, which costs a little quality. Crop from the original where you can.',
    ],
    faqs: [
      {
        q: 'How do I crop to an exact size like 1080 x 1080?',
        a: 'Type 1080 into both the width and height boxes. The crop frame locks to that exact output size and you simply drag it to choose which part of the photo to keep. The output will be exactly 1080 x 1080 pixels, not approximately.',
      },
      {
        q: 'What is the difference between cropping and resizing?',
        a: 'Cropping cuts pixels away from the edges and keeps the rest at their original size. Resizing keeps the whole picture but scales every pixel. If your image is the wrong shape, crop. If it is the right shape but the wrong size, resize.',
      },
      {
        q: 'Can I crop to a circle?',
        a: 'Not with this tool, which produces rectangular crops. The profile picture maker does circular crops with a transparent background, which is what you want for an avatar.',
      },
      {
        q: 'What aspect ratio should I use for each platform?',
        a: 'Common ones: 1:1 for Instagram squares and marketplace listing photos, 4:5 for Instagram portrait posts, 16:9 for YouTube thumbnails and video, 9:16 for Stories, Reels and TikTok, and 2:3 for Pinterest pins.',
      },
    ],
  },

  // ───────────────────────────── METADATA ─────────────────────────────
  {
    slug: 'remove-exif-data',
    name: 'Remove EXIF Data',
    h1: 'Remove EXIF Data from Photos',
    title: 'Remove EXIF Data – Strip Photo Metadata and GPS',
    description:
      'See exactly what your photo reveals, then strip it without re-compressing. Pixels stay identical, so image quality is completely untouched.',
    blurb:
      'First see what is actually hidden in your photo — camera, timestamp, and often the exact GPS coordinates. Then remove it. The pixels are never re-encoded, so quality is untouched.',
    category: 'metadata',
    related: ['change-image-dpi', 'heic-to-jpg', 'compress-jpg', 'add-watermark'],
    steps: [
      'Drop a photo onto the box above. Nothing is sent anywhere — the metadata is read on your device.',
      'Read the report showing what the file contains, including any GPS coordinates.',
      'Choose whether to keep the colour profile, which affects how colours display, and then strip the rest.',
      'Download the cleaned file. It will be byte-for-byte identical apart from the removed metadata.',
    ],
    limits: [
      'Metadata removal cannot undo anything already published. If a photo with GPS data is already online, removing it from your copy changes nothing about the copy they have.',
      'The image itself may still identify a location through recognisable landmarks, street signs or reflections. Metadata removal is not anonymity.',
      'Colour profiles are kept by default. Removing the profile makes the file smaller but can visibly shift colours on wide-gamut displays.',
      'Some social platforms strip metadata on upload anyway, and others do not. Do not rely on the platform to do it for you.',
    ],
    faqs: [
      {
        q: 'What is actually stored in EXIF data?',
        a: 'Camera make and model, lens, shutter speed, aperture, ISO, the exact date and time the shot was taken, orientation, software used to edit it, and on a phone with location services enabled, GPS coordinates typically accurate to within a few metres. Some files also carry a thumbnail of the original image, which survives cropping in some editors.',
      },
      {
        q: 'Why does this not reduce quality when other tools do?',
        a: 'Most tools decode the image and save a new one, which re-compresses every pixel and loses quality. This tool works on the file structure directly, copying the compressed image data across byte-for-byte and simply omitting the metadata blocks. The pixels that come out are mathematically identical to the pixels that went in.',
      },
      {
        q: 'Does removing EXIF make the file smaller?',
        a: 'A little. Metadata is usually a few kilobytes, occasionally more if the file carries an embedded thumbnail or a large colour profile. It is a privacy tool rather than a compression tool — use the JPG compressor if size is your goal.',
      },
      {
        q: 'Should I remove the colour profile too?',
        a: 'Usually not. The colour profile tells displays how to interpret the colours. Removing it saves a few kilobytes but can make images look washed out or oversaturated on wide-gamut screens. Keep it unless you know your image is plain sRGB.',
      },
      {
        q: 'Do social networks remove this data automatically?',
        a: 'Some do, some do not, and the behaviour changes without notice. Facebook and Instagram strip most of it. Direct file sharing over email, messaging apps in file mode, cloud links and personal websites usually do not. Strip it yourself rather than trusting the platform.',
      },
      {
        q: 'Can removed EXIF data be recovered?',
        a: 'Not from the cleaned file — the bytes are genuinely gone. But your original still has it, and so does any copy already shared.',
      },
    ],
  },
  {
    slug: 'change-image-dpi',
    name: 'Change Image DPI',
    h1: 'Change the DPI of an Image',
    title: 'Change Image DPI – Set 300 DPI for Printing',
    description:
      'Change an image DPI to 300, 600 or any value. Updates both the JFIF and EXIF fields so Photoshop and Word actually read the new value.',
    blurb:
      'Set an image to 300 DPI for print, or any other value. Writes every field that matters, so the change actually shows up when the printer opens the file.',
    category: 'metadata',
    related: ['resize-image', 'remove-exif-data', 'crop-image', 'compress-jpg'],
    steps: [
      'Drop an image onto the box above.',
      'Choose a DPI, or type your own. 300 is standard for print, 72 or 96 for screens.',
      'Decide between metadata only, which keeps the pixels untouched, and resample, which changes the actual pixel dimensions.',
      'Check the print size shown in inches and centimetres, then download.',
    ],
    limits: [
      'Changing DPI alone does not add detail. A 500 x 500 image tagged as 300 DPI is still 500 x 500 pixels and will print at just over 4 cm across.',
      'WebP files have nowhere to store DPI. Convert to JPG or PNG first if you need a print resolution setting.',
      'Some print services ignore the embedded value entirely and work purely from pixel dimensions and your chosen paper size.',
    ],
    faqs: [
      {
        q: 'Why did my DPI change not work in Photoshop?',
        a: 'Almost always because the tool you used wrote only the JFIF density field and left the EXIF resolution fields untouched. Photoshop reads the EXIF values and shows the old number. This tool writes both, and inserts the JFIF header if the file does not have one, so the value is consistent everywhere.',
      },
      {
        q: 'Does DPI affect image quality?',
        a: 'On its own, no. DPI is a note attached to the file saying how large it should print. The actual quality comes from the pixel dimensions. An image is not improved by relabelling it — what matters is having enough pixels for the size you want to print.',
      },
      {
        q: 'How many pixels do I need for a 300 DPI print?',
        a: 'Multiply the print size in inches by 300. A 4 x 6 inch photo needs 1200 x 1800 pixels. An A4 page at 300 DPI needs about 2480 x 3508. The tool shows you the resulting print size as you change the setting.',
      },
      {
        q: 'What is the difference between metadata only and resample?',
        a: 'Metadata only changes the label and leaves every pixel exactly as it was, so the file is unchanged in quality and the print size changes. Resample actually adds or removes pixels to keep the physical size the same at the new DPI. For a printer asking for 300 DPI, metadata only is nearly always what they mean.',
      },
      {
        q: 'What is the difference between DPI and PPI?',
        a: 'Strictly, PPI describes pixels in a digital image and DPI describes ink dots a printer places on paper. In everyday use, and in every image editor, the two are used interchangeably for the number stored in the file. This tool writes the field that both terms refer to.',
      },
    ],
  },

  // ───────────────────────────── GENERATE ─────────────────────────────
  {
    slug: 'add-watermark',
    name: 'Add Watermark',
    h1: 'Add a Watermark to Images',
    title: 'Add Watermark to Image – Text or Logo, in Batch',
    description:
      'Add a text or logo watermark to one image or hundreds at once. Control position, size, opacity, rotation and tiling. No upload required.',
    blurb:
      'Put your name or logo on your photos. Set it once and apply it to a whole batch, with control over position, size, transparency, rotation and tiling.',
    category: 'generate',
    related: ['resize-image', 'compress-jpg', 'social-media-image-sizes', 'crop-image'],
    steps: [
      'Drop the images you want watermarked onto the box above.',
      'Type your watermark text, or upload a logo file — a transparent PNG works best.',
      'Position it using the nine-point grid, then adjust size, opacity and rotation. Turn on tiling to repeat it across the whole image.',
      'Apply to every image in the batch and download them as a ZIP.',
    ],
    limits: [
      'A watermark is a deterrent, not protection. Anyone determined enough can remove or crop one, and automated tools have got good at it. Place it over an important part of the image if that matters to you.',
      'Watermarks are permanently burned into the output. Keep your unwatermarked originals.',
      'A logo watermark scales relative to each image, so a batch of mixed sizes will show slightly different results. Check a couple before committing to a large batch.',
    ],
    faqs: [
      {
        q: 'Where should I place a watermark?',
        a: 'A corner at low opacity is the least intrusive and the most common choice, but it is also the easiest to crop off. Across the centre at very low opacity is much harder to remove but interferes with the image. Tiled repetition is the hardest to defeat and the most intrusive. Match the choice to how much you actually mind about theft.',
      },
      {
        q: 'What opacity works best?',
        a: 'Between 25 and 50 percent suits most photographs. Below 20 percent it disappears against busy backgrounds, and above 60 percent it starts to dominate the image. Preview against your darkest and lightest photos, since a single setting has to work for both.',
      },
      {
        q: 'Can I use my own logo?',
        a: 'Yes. Upload a PNG with a transparent background for the cleanest result. A logo on a solid white rectangle will show that rectangle over your photo. Both light and dark versions are worth keeping so you can switch depending on the image.',
      },
      {
        q: 'Will a watermark hurt my Etsy or Amazon listings?',
        a: 'On Amazon, yes — watermarks and text overlays on the main product image are against their image requirements and can get a listing suppressed. Etsy allows them but many sellers find they reduce conversions. They make far more sense on blog images, portfolio work and social posts.',
      },
      {
        q: 'Does watermarking reduce image quality?',
        a: 'The watermark itself is drawn cleanly, but saving the result re-encodes the file, which costs a small amount of quality on a JPG. Work from your original rather than watermarking an already-compressed copy.',
      },
    ],
  },
  {
    slug: 'profile-picture-maker',
    name: 'Profile Picture Maker',
    h1: 'Make a Circular Profile Picture',
    title: 'Profile Picture Maker – Crop a Photo into a Circle',
    description:
      'Crop any photo into a perfect circle for a profile picture. Zoom, reposition, add a border, and export a transparent PNG at any size.',
    blurb:
      'Crop a photo into a clean circle for your avatar. Zoom and drag to frame your face properly, add a border if you want one, and export at the exact size the platform needs.',
    category: 'resize',
    related: ['crop-image', 'resize-image', 'social-media-image-sizes', 'compress-png'],
    steps: [
      'Drop a photo onto the box above.',
      'Drag to position your face and use the zoom slider to frame it. Keep a little space above the head.',
      'Choose an output size, and optionally add a border or a solid background colour.',
      'Download as a transparent PNG, or as a JPG with a background if the platform requires it.',
    ],
    limits: [
      'A transparent PNG shows a circle on any background. A JPG cannot store transparency, so it will always have square corners in whatever colour you choose.',
      'Most platforms crop avatars to a circle themselves. Pre-cropping mainly helps you control the framing rather than the shape.',
      'Small source photos produce small avatars. For a 400 x 400 output you want a face occupying at least 400 pixels in the original.',
    ],
    faqs: [
      {
        q: 'What size should my profile picture be?',
        a: 'Larger than you think, because platforms downscale but never upscale. 400 x 400 is a safe minimum, 800 x 800 covers almost everything including YouTube, and 1000 x 1000 future-proofs it. Uploading a large square and letting the platform resize gives a better result than uploading something exactly at the minimum.',
      },
      {
        q: 'Should I download a PNG or a JPG?',
        a: 'PNG if you want genuine transparency outside the circle, which looks correct on any background colour. JPG if the platform rejects PNG or if file size matters — but pick a background colour that matches where it will appear.',
      },
      {
        q: 'Why does my profile picture look blurry after uploading?',
        a: 'Usually because the source was too small and the platform stretched it, or because the platform compressed it heavily. Start from the largest, sharpest photo you have and export at or above the platform recommendation.',
      },
      {
        q: 'How should I frame my face?',
        a: 'Fill most of the circle with your head and shoulders, leaving a small margin above the head. Avatars display very small in most places, so a full body shot becomes an unrecognisable smudge at 40 pixels across.',
      },
    ],
  },
  {
    slug: 'favicon-generator',
    name: 'Favicon Generator',
    h1: 'Generate a Favicon from an Image',
    title: 'Favicon Generator – Create favicon.ico from an Image',
    description:
      'Turn any image into a complete favicon set: multi-size favicon.ico, PNGs, Apple touch icon, web manifest and the HTML to paste into your site.',
    blurb:
      'Upload one image and get the whole favicon set a modern site needs: a true multi-resolution favicon.ico, every PNG size, the Apple touch icon, a web manifest, and the HTML to paste in.',
    category: 'generate',
    related: ['profile-picture-maker', 'resize-image', 'compress-png', 'crop-image'],
    steps: [
      'Drop a square image onto the box above. A simple, high contrast logo works far better than a photo.',
      'Check the previews at each size, especially 16 x 16 where fine detail disappears.',
      'Optionally set a background colour and theme colour for the web manifest.',
      'Download the ZIP, unpack it into your website root, and paste the supplied HTML into your head tag.',
    ],
    limits: [
      'Detailed logos become unreadable at 16 x 16 pixels. If your logo has fine text, use just the symbol or a single letter for the small sizes.',
      'The generated favicon.ico contains the 16, 32 and 48 pixel versions, which is what browsers actually use. Larger sizes are supplied as separate PNGs, which is current practice.',
      'Browsers cache favicons aggressively. After replacing one you may need a hard refresh, or to visit the icon URL directly, before you see the change.',
    ],
    faqs: [
      {
        q: 'Do I still need a favicon.ico file?',
        a: 'Yes. Browsers and crawlers still request /favicon.ico from the site root even when PNG icons are declared in the HTML, and some tools only look for that file. The ICO produced here holds the 16, 32 and 48 pixel versions in one file, which is exactly what it is for.',
      },
      {
        q: 'What sizes are actually needed?',
        a: '16 and 32 for browser tabs, 48 for the Windows taskbar and some bookmark views, 180 for the Apple touch icon on iOS home screens, and 192 and 512 for Android and progressive web apps via the manifest. All of these are in the ZIP.',
      },
      {
        q: 'Where do the files go on my website?',
        a: 'Everything goes in the root folder of your site, so they are reachable at yoursite.com/favicon.ico and so on. Then paste the supplied link tags into the head of your pages. The manifest is referenced from the HTML rather than found automatically.',
      },
      {
        q: 'Why does my favicon look like a blob?',
        a: 'Because 16 x 16 pixels is roughly the size of a full stop on screen. Detailed artwork simply cannot survive it. Successful favicons are almost always a single shape, letter or symbol with strong contrast against both light and dark tab backgrounds.',
      },
      {
        q: 'Can I use an SVG favicon instead?',
        a: 'You can, and modern browsers support it, which is why an SVG is worth adding alongside. But you still need the ICO and the PNGs for older browsers, for iOS home screens, and for Android. The ZIP covers those.',
      },
    ],
  },
  {
    slug: 'social-media-image-sizes',
    name: 'Social Media Sizes',
    h1: 'Resize Images for Social Media and Marketplaces',
    title: 'Social Media Image Sizes – Resize for Any Platform',
    description:
      'Resize one image to the correct size for Instagram, YouTube, Etsy, Amazon, Pinterest and more. Pick your presets and download them all as a ZIP.',
    blurb:
      'One image in, every size you need out. Pick the platforms you post to and get correctly sized files for each, generated in your browser and bundled into a single ZIP.',
    category: 'generate',
    related: ['resize-image', 'crop-image', 'compress-jpg', 'add-watermark'],
    steps: [
      'Drop your source image onto the box above. The bigger the original, the better every output will be.',
      'Tick the platforms and placements you need. Selecting several is the point of the tool.',
      'Check each preview and nudge the crop where the automatic framing has cut something important.',
      'Download everything as a ZIP with sensible file names.',
    ],
    limits: [
      'Platforms change their recommended sizes without much warning. The sizes here are checked periodically, but always confirm anything critical against the platform own documentation.',
      'Automatic cropping centres the frame. It has no idea where the subject of your photo is, so check the previews before downloading.',
      'A source image smaller than a target size will have to be enlarged, and will look soft. Start from the largest original you have.',
    ],
    faqs: [
      {
        q: 'What size should an Instagram post be?',
        a: '1080 x 1080 for a square, 1080 x 1350 for a portrait post, which occupies the most space in the feed, and 1080 x 1920 for Stories and Reels. Instagram compresses whatever you upload, so send a clean 1080 pixel wide file rather than something enormous.',
      },
      {
        q: 'What size should a YouTube thumbnail be?',
        a: 'YouTube now recommends 3840 x 2160 at 16:9, with a minimum width of 640 pixels. Most guides still say 1280 x 720, which is the old advice — it still works, but it is no longer what YouTube asks for. The file size cap depends on where you upload from: 2 MB from mobile, 50 MB from desktop. If you are hitting the 2 MB wall, you are uploading from your phone.',
      },
      {
        q: 'What size should Etsy listing photos be?',
        a: 'Etsy recommends at least 2000 pixels on the shortest side, and a square 2000 x 2000 is the safest choice because it is what the listing grid expects. Larger is fine; Etsy resizes it.',
      },
      {
        q: 'What does Amazon require for product images?',
        a: 'The main image needs to be at least 1000 pixels on the longest side to enable zoom, and 1600 pixels or more is recommended. It must be on a pure white background, with the product filling around 85 percent of the frame, and no watermarks, logos or added text.',
      },
      {
        q: 'Why not just upload one big image everywhere?',
        a: 'Because each platform crops to its own aspect ratio. Upload a square to a placement expecting 16:9 and the platform decides what to cut, which is frequently somebody head. Sizing deliberately means you choose the framing.',
      },
    ],
  },
];

/** Lookup helpers ---------------------------------------------------------- */

export const TOOL_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export function getTool(slug: string): Tool {
  const tool = TOOL_BY_SLUG[slug];
  if (!tool) throw new Error(`Unknown tool slug: "${slug}". Add it to src/data/tools.ts.`);
  return tool;
}

export function toolsInCategory(id: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === id);
}

export function getCategory(id: CategoryId): Category {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: "${id}"`);
  return cat;
}

export function relatedTools(tool: Tool): Tool[] {
  return tool.related.map(getTool);
}
