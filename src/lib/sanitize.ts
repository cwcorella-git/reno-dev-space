/**
 * HTML sanitizer for rich text content.
 * Allows formatting tags (b, i, u, span with inline styles, br) but strips
 * dangerous elements (script, event handlers, etc.)
 */

// Allowed tags for rich text formatting
const ALLOWED_TAGS = new Set(['b', 'i', 'u', 's', 'strong', 'em', 'span', 'br'])

// Allowed CSS properties for inline styles
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
])

/**
 * Sanitize an inline style string, keeping only allowed properties.
 */
function sanitizeStyle(style: string): string {
  const allowed: string[] = []

  // Parse style declarations
  const declarations = style.split(';').map(d => d.trim()).filter(Boolean)

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':')
    if (colonIndex === -1) continue

    const prop = decl.slice(0, colonIndex).trim().toLowerCase()
    const value = decl.slice(colonIndex + 1).trim()

    if (ALLOWED_STYLE_PROPS.has(prop) && value) {
      // Basic validation: no url(), no javascript:
      if (!value.includes('url(') && !value.includes('javascript:')) {
        allowed.push(`${prop}: ${value}`)
      }
    }
  }

  return allowed.join('; ')
}

/**
 * Sanitize HTML content for safe rendering.
 * Preserves formatting tags (b, i, u, span with style) and removes dangerous content.
 */
export function sanitizeHtml(html: string): string {
  // Create a temporary container to parse the HTML
  const container = document.createElement('div')
  container.innerHTML = html

  // Recursively process nodes
  function processNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode()
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      // Check if tag is allowed
      if (!ALLOWED_TAGS.has(tagName)) {
        // Not allowed - return just the text content as a text node
        const fragment = document.createDocumentFragment()
        for (const child of Array.from(element.childNodes)) {
          const processed = processNode(child)
          if (processed) fragment.appendChild(processed)
        }
        return fragment
      }

      // Create a clean element
      const clean = document.createElement(tagName)

      // Only copy style attribute, and sanitize it
      if (element.hasAttribute('style')) {
        const sanitizedStyle = sanitizeStyle(element.getAttribute('style') || '')
        if (sanitizedStyle) {
          clean.setAttribute('style', sanitizedStyle)
        }
      }

      // Process children
      for (const child of Array.from(element.childNodes)) {
        const processed = processNode(child)
        if (processed) clean.appendChild(processed)
      }

      return clean
    }

    return null
  }

  // Process all children
  const result = document.createDocumentFragment()
  for (const child of Array.from(container.childNodes)) {
    const processed = processNode(child)
    if (processed) result.appendChild(processed)
  }

  // Convert back to HTML string
  const output = document.createElement('div')
  output.appendChild(result)
  return output.innerHTML
}

/**
 * Check if content contains any HTML tags.
 */
export function containsHtml(content: string): boolean {
  return /<[^>]+>/.test(content)
}

/**
 * Convert plain text to HTML-safe text (escape special characters).
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
