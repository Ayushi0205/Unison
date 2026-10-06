/**
 * Unfilled {{tokens}} inside attribute values (e.g. href="{{unsubscribe_url}}")
 * can't be rendered as chips without breaking the markup, so point them at "#".
 * Call before the chip pass in any preview compiler.
 */
export function neutralizeAttributeTokens(html: string): string {
  return html.replace(/="([^"]*)"/g, (match, value: string) => (value.includes('{{') ? '="#"' : match))
}
