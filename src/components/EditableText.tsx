'use client'

import { createElement } from 'react'
import { useContent } from '@/contexts/ContentContext'

interface EditableTextProps {
  id: string
  defaultValue: string
  category: string
  description?: string
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'label'
  className?: string
  multiline?: boolean
}

export function EditableText({
  id,
  defaultValue,
  as = 'span',
  className = '',
}: EditableTextProps) {
  const { getText } = useContent()
  const currentValue = getText(id, defaultValue)

  return createElement(as, { className }, currentValue)
}
