'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { EditableText } from '@/components/EditableText'
import { EditorTab } from './EditorTab'

type EmailTemplate = 'verify-email' | 'campaign-success' | 'campaign-ended' | 'campaign-update'

interface TemplateInfo {
  id: EmailTemplate
  name: string
  description: string
  sampleData: Record<string, string>
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'verify-email',
    name: 'Email Verification',
    description: 'Sent automatically when a user signs up',
    sampleData: {
      VERIFICATION_LINK: 'https://cwcorella-git.github.io/reno-dev-space/'
    }
  },
  {
    id: 'campaign-success',
    name: 'Campaign Success',
    description: 'Sent when funding goal is reached',
    sampleData: {
      TOTAL_RAISED: '15,250',
      BACKER_COUNT: '47',
      USER_PLEDGE: '100'
    }
  },
  {
    id: 'campaign-ended',
    name: 'Campaign Ended',
    description: 'Sent when campaign ends without reaching goal',
    sampleData: {
      TOTAL_RAISED: '8,500',
      PERCENT: '56',
      USER_PLEDGE: '100'
    }
  },
  {
    id: 'campaign-update',
    name: 'Campaign Update',
    description: 'Periodic progress updates',
    sampleData: {
      MILESTONE_TITLE: 'Halfway There!',
      MILESTONE_MESSAGE: "We've hit 50% of our funding goal!",
      DAYS_LEFT: '7',
      CURRENT_AMOUNT: '6,250',
      GOAL_AMOUNT: '15,000',
      PERCENT: '42',
      BACKER_COUNT: '23',
      USER_PLEDGE: '100',
      NEW_BACKERS: '5',
      DAILY_AVERAGE: '125',
      NEEDED: '8,750'
    }
  }
]

export function EmailsPanel() {
  const { user, isAdmin } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>('verify-email')
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Enable/disable contentEditable on iframe when edit mode changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const iframeDoc = iframe.contentDocument
    if (!iframeDoc || !iframeDoc.body) return

    if (isEditing) {
      iframeDoc.body.contentEditable = 'true'
      iframeDoc.body.style.outline = 'none'
      iframeDoc.body.style.cursor = 'text'
    } else {
      iframeDoc.body.contentEditable = 'false'
      iframeDoc.body.style.cursor = 'default'
    }
  }, [isEditing, previewHtml])

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        <EditableText id="panel.admin.required" defaultValue="Admin access required" category="panel" />
      </div>
    )
  }

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate)!

  const handlePreview = async () => {
    setLoading(true)
    try {
      // Use correct base path for GitHub Pages deployment
      const basePath = process.env.NODE_ENV === 'production' ? '/reno-dev-space' : ''
      const templatePath = `${basePath}/email-templates/${selectedTemplate}.html`
      const response = await fetch(templatePath)

      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status} ${response.statusText}`)
      }

      let html = await response.text()

      // Replace template variables with sample data
      Object.entries(currentTemplate.sampleData).forEach(([key, value]) => {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value)
      })

      setPreviewHtml(html)
      setShowPreview(true)
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('Failed to load email template. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Template Selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">
            <EditableText id="emails.label.template" defaultValue="Email Template" category="emails" />
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value as EmailTemplate)
              setShowPreview(false)
            }}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
          >
            {TEMPLATES.map(template => (
              <option key={template.id} value={template.id} className="bg-gray-800">
                {template.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{currentTemplate.description}</p>
        </div>

        {/* Preview Button */}
        <button
          onClick={handlePreview}
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? '...' : <EditableText id="emails.button.preview" defaultValue="Preview Email" category="emails" />}
        </button>

        {/* Template Variables Info */}
        {!showPreview && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">
              <EditableText id="emails.label.variables" defaultValue="Template Variables:" category="emails" />
            </p>
            <div className="space-y-1">
              {Object.entries(currentTemplate.sampleData).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <code className="text-indigo-400">{`{{${key}}}`}</code>
                  <span className="text-gray-500">=</span>
                  <span className="text-gray-300">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note about editing */}
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
          <p className="text-xs text-amber-200">
            <EditableText
              id="emails.note.editing"
              defaultValue="Note: Template editing coming soon. Currently showing preview with sample data."
              category="emails"
            />
          </p>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            setShowPreview(false)
            setIsEditing(false)
          }}
        >
          <div className="relative w-full max-w-3xl max-h-[95vh] bg-gray-900 rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div>
                <h3 className="text-white font-semibold">{currentTemplate.name}</h3>
                <p className="text-xs text-gray-400">{currentTemplate.description}</p>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false)
                  setIsEditing(false)
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Editor Toolbar (shown when editing) */}
            {isEditing && (
              <div className="border-b border-white/10 bg-gray-800/50">
                <div className="px-4 py-2">
                  <p className="text-xs text-amber-400 mb-2">
                    Click elements in the preview below to edit them. Changes are live preview only.
                  </p>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                  >
                    Exit Edit Mode
                  </button>
                </div>
              </div>
            )}

            {/* Preview - flexible height that fills remaining space */}
            <div className="p-4 flex-1 overflow-auto">
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                className={`w-full h-full min-h-[600px] bg-white rounded border ${
                  isEditing ? 'border-amber-400/40' : 'border-white/10'
                } ${isEditing ? 'cursor-text' : 'cursor-pointer'}`}
                title="Email Preview"
                onClick={() => {
                  if (!isEditing) {
                    setIsEditing(true)
                    // Make iframe content editable
                    setTimeout(() => {
                      const iframeDoc = iframeRef.current?.contentDocument
                      if (iframeDoc && iframeDoc.body) {
                        iframeDoc.body.contentEditable = 'true'
                        iframeDoc.body.style.outline = 'none'
                      }
                    }, 100)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
