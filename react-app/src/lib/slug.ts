/**
 * Build a URL slug from a product or category name.
 *
 * Mirrors the server's `Str::slug()` for the Latin text an admin typically
 * types: accents are folded, everything except `a-z`/`0-9` becomes a dash, and
 * leading/trailing dashes are dropped. Burmese script has no ASCII
 * transliteration, so a Burmese-only name yields an empty string and the
 * field stays empty for the admin to fill in (or for the server to reject
 * with its usual "slug is required" message).
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255)
    .replace(/-+$/g, '');
}
