/**
 * Selection API wrappers for inline text formatting.
 * Uses browser's Selection API to wrap selected text in formatting elements.
 */

/**
 * Check if there's a valid text selection within the given container.
 */
export function hasSelectionInContainer(container: HTMLElement | null): boolean {
  if (!container) return false

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)
  return container.contains(range.commonAncestorContainer)
}

/**
 * Wrap the current selection with an inline style span.
 * Returns true if selection was wrapped, false if no valid selection.
 */
export function wrapSelectionWithStyle(
  style: Record<string, string>,
  container: HTMLElement | null
): boolean {
  if (!container) return false

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)

  // Ensure selection is within the container
  if (!container.contains(range.commonAncestorContainer)) {
    return false
  }

  try {
    // Create styled span
    const span = document.createElement('span')
    Object.entries(style).forEach(([key, value]) => {
      span.style.setProperty(key, value)
    })

    // Wrap the selection
    range.surroundContents(span)

    // Clear selection
    selection.removeAllRanges()

    return true
  } catch {
    // surroundContents can throw if selection crosses element boundaries
    // Fall back to extracting and re-inserting
    return wrapSelectionWithStyleFallback(range, style, selection)
  }
}

/**
 * Fallback method when surroundContents fails (selection crosses boundaries).
 */
function wrapSelectionWithStyleFallback(
  range: Range,
  style: Record<string, string>,
  selection: Selection
): boolean {
  try {
    // Extract the selected content
    const fragment = range.extractContents()

    // Create styled wrapper
    const span = document.createElement('span')
    Object.entries(style).forEach(([key, value]) => {
      span.style.setProperty(key, value)
    })

    // Insert the fragment into the span
    span.appendChild(fragment)

    // Insert the span at the range position
    range.insertNode(span)

    // Clear selection
    selection.removeAllRanges()

    return true
  } catch {
    return false
  }
}

/**
 * Wrap the current selection with a semantic tag (b, i, u).
 * Returns true if selection was wrapped, false if no valid selection.
 */
export function wrapSelectionWithTag(
  tag: 'b' | 'i' | 'u',
  container: HTMLElement | null
): boolean {
  if (!container) return false

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)

  // Ensure selection is within the container
  if (!container.contains(range.commonAncestorContainer)) {
    return false
  }

  try {
    // Create the tag element
    const element = document.createElement(tag)

    // Wrap the selection
    range.surroundContents(element)

    // Clear selection
    selection.removeAllRanges()

    return true
  } catch {
    // Fall back for cross-boundary selections
    return wrapSelectionWithTagFallback(range, tag, selection)
  }
}

/**
 * Fallback method when surroundContents fails for tags.
 */
function wrapSelectionWithTagFallback(
  range: Range,
  tag: 'b' | 'i' | 'u',
  selection: Selection
): boolean {
  try {
    const fragment = range.extractContents()
    const element = document.createElement(tag)
    element.appendChild(fragment)
    range.insertNode(element)
    selection.removeAllRanges()
    return true
  } catch {
    return false
  }
}

/**
 * Wrap the current selection with an anchor tag (link).
 * Returns true if selection was wrapped, false if no valid selection.
 */
export function wrapSelectionWithLink(
  href: string,
  container: HTMLElement | null
): boolean {
  if (!container || !href) return false

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)

  // Ensure selection is within the container
  if (!container.contains(range.commonAncestorContainer)) {
    return false
  }

  try {
    const anchor = document.createElement('a')
    anchor.href = href.startsWith('http') ? href : `https://${href}`
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.className = 'text-indigo-400 hover:text-indigo-300 underline'

    range.surroundContents(anchor)
    selection.removeAllRanges()
    return true
  } catch {
    // Fall back for cross-boundary selections
    try {
      const fragment = range.extractContents()
      const anchor = document.createElement('a')
      anchor.href = href.startsWith('http') ? href : `https://${href}`
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.className = 'text-indigo-400 hover:text-indigo-300 underline'
      anchor.appendChild(fragment)
      range.insertNode(anchor)
      selection.removeAllRanges()
      return true
    } catch {
      return false
    }
  }
}

/**
 * Get the element ID of the block containing the current selection.
 * Returns null if no valid selection or not within a contentEditable.
 */
export function getSelectedBlockElement(): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  let node: Node | null = range.commonAncestorContainer

  // Walk up to find contentEditable element
  while (node) {
    if (node instanceof HTMLElement && node.contentEditable === 'true') {
      return node
    }
    node = node.parentNode
  }

  return null
}
