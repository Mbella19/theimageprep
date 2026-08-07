/**
 * Reads EXIF for DISPLAY.
 *
 * The EXIF remover shows you what is in the file before it takes it away. That
 * ordering is the whole design: "remove metadata" is an abstraction most people
 * cannot evaluate, whereas "this photo says it was taken at 51.5074, -0.1278 on
 * 15 March at 14:22" is immediately understandable.
 *
 * Parsing happens on your device like everything else here; nothing is sent
 * anywhere to be read.
 */

export interface GpsInfo {
  latitude: number;
  longitude: number;
  /** OpenStreetMap link — no account, no tracking, works without a key. */
  mapUrl: string;
  label: string;
}

export interface ExifField {
  label: string;
  value: string;
  /** Fields worth calling out in red rather than listing quietly. */
  sensitive?: boolean;
}

export interface ExifSummary {
  hasMetadata: boolean;
  /** Bytes of metadata found, approximately. */
  gps: GpsInfo | null;
  camera: string | null;
  lens: string | null;
  takenAt: string | null;
  software: string | null;
  orientation: number | null;
  fields: ExifField[];
  /** Reason parsing failed, if it did. */
  error?: string;
}

const EMPTY: ExifSummary = {
  hasMetadata: false,
  gps: null,
  camera: null,
  lens: null,
  takenAt: null,
  software: null,
  orientation: null,
  fields: [],
};

function describe(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return null;
}

/** exifreader returns tags as { description, value }; description reads better. */
function tagText(tag: unknown): string | null {
  if (!tag || typeof tag !== 'object') return null;
  const record = tag as { description?: unknown; value?: unknown };
  return describe(record.description) ?? describe(record.value);
}

export async function readExif(bytes: ArrayBuffer): Promise<ExifSummary> {
  let tags: Record<string, any>;
  try {
    // Loaded on demand: most tools never need it, and it is not a small library.
    const ExifReader = (await import('exifreader')).default;
    tags = ExifReader.load(bytes, { expanded: true }) as Record<string, any>;
  } catch (error) {
    return {
      ...EMPTY,
      error: error instanceof Error ? error.message : 'Could not read the metadata.',
    };
  }

  const exif = tags.exif ?? {};
  const gpsTags = tags.gps ?? {};
  const fields: ExifField[] = [];

  const push = (label: string, value: string | null, sensitive = false) => {
    if (value) fields.push({ label, value, sensitive });
  };

  // ── Location ─────────────────────────────────────────────────────────────
  let gps: GpsInfo | null = null;
  const lat = typeof gpsTags.Latitude === 'number' ? gpsTags.Latitude : null;
  const lon = typeof gpsTags.Longitude === 'number' ? gpsTags.Longitude : null;

  if (lat !== null && lon !== null) {
    const label = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    gps = {
      latitude: lat,
      longitude: lon,
      label,
      mapUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
    };
    fields.push({ label: 'GPS coordinates', value: label, sensitive: true });
    if (typeof gpsTags.Altitude === 'number') {
      push('Altitude', `${Math.round(gpsTags.Altitude)} m`, true);
    }
  }

  // ── Camera and capture ───────────────────────────────────────────────────
  const make = tagText(exif.Make);
  const model = tagText(exif.Model);
  const camera = model
    ? make && !model.startsWith(make)
      ? `${make} ${model}`
      : model
    : make;

  const lens = tagText(exif.LensModel) ?? tagText(exif.Lens);
  const takenAt = tagText(exif.DateTimeOriginal) ?? tagText(exif.DateTime);
  const software = tagText(exif.Software);

  push('Camera', camera, true);
  push('Lens', lens);
  push('Date taken', takenAt, true);
  push('Software', software);
  push('Exposure', tagText(exif.ExposureTime));
  push('Aperture', tagText(exif.FNumber));
  push('ISO', tagText(exif.ISOSpeedRatings) ?? tagText(exif.PhotographicSensitivity));
  push('Focal length', tagText(exif.FocalLength));
  push('Flash', tagText(exif.Flash));
  push('Artist', tagText(exif.Artist), true);
  push('Copyright', tagText(exif.Copyright));
  push('Serial number', tagText(exif.BodySerialNumber), true);

  const orientationTag = exif.Orientation;
  const orientation =
    orientationTag && typeof orientationTag.value === 'number' ? orientationTag.value : null;
  if (orientation && orientation !== 1) {
    fields.push({
      label: 'Orientation',
      value: `${tagText(orientationTag) ?? orientation} — the image is stored rotated`,
    });
  }

  // ── Other embedded blocks worth mentioning ───────────────────────────────
  if (tags.xmp && Object.keys(tags.xmp).length > 0) {
    fields.push({ label: 'XMP block', value: 'Present — editing history and tags' });
  }
  if (tags.iptc && Object.keys(tags.iptc).length > 0) {
    fields.push({ label: 'IPTC block', value: 'Present — captions, keywords, credits' });
  }
  if (tags.icc && Object.keys(tags.icc).length > 0) {
    const profile = tagText(tags.icc['Profile Description' as keyof typeof tags.icc]);
    fields.push({
      label: 'Colour profile',
      value: profile ?? 'Present — kept by default so colours stay accurate',
    });
  }
  if (tags.Thumbnail) {
    fields.push({
      label: 'Embedded thumbnail',
      value: 'Present — a small copy of the original image',
      sensitive: true,
    });
  }

  return {
    hasMetadata: fields.length > 0,
    gps,
    camera,
    lens,
    takenAt,
    software,
    orientation,
    fields,
  };
}
