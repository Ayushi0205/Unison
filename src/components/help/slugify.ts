/** Turns a heading into a URL-safe anchor id, e.g. "Add a rule" → "add-a-rule". */
export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
