/**
 * Converts HTML content to clean, readable text
 * Removes HTML tags and cleans up whitespace
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n\n') // Keep paragraph breaks but clean them up
    .trim();

  return text;
}