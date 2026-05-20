/**
 * Module declarations for Worker text imports.
 * Matches the `rules` config in wrangler.jsonc that maps `*.html` to text modules.
 */
declare module '*.html' {
  const content: string
  export default content
}
