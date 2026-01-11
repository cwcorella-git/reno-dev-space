'use client'

import { useState, useRef, useEffect, KeyboardEvent, MouseEvent, createElement } from 'react'
import { useAuth } from '@/contexts/AuthContext'
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
  category,
  description,
  as = 'span',
  className = '',
  multiline = false,
}: EditableTextProps) {
  const { isAdmin } = useAuth()
  const { getText, updateText } = useContent()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  const currentValue = getText(id, defaultValue)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = (e: MouseEvent) => {
    if (isAdmin && e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      setEditValue(currentValue)
      setIsEditing(true)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = async () => {
    if (editValue !== currentValue) {
      await updateText(id, editValue, category, description)
    }
    setIsEditing(false)
  }

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input'
    return createElement(InputComponent, {
      ref: inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: handleSave,
      className: `${className} bg-indigo-900/50 border border-indigo-500 rounded px-1 outline-none min-w-[100px]`,
      style: multiline ? { resize: 'vertical', minHeight: '60px' } : undefined,
      rows: multiline ? 3 : undefined,
    })
  }

  return createElement(
    as,
    {
      className: `${className} ${isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-indigo-500/30 hover:ring-offset-1 hover:ring-offset-transparent rounded' : ''}`,
      onClick: handleClick,
      title: isAdmin ? 'Ctrl+click to edit' : undefined,
    },
    currentValue
  )
}
