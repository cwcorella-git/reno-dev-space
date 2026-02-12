'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { EditableText } from '@/components/EditableText'
import { EditorTab } from './EditorTab'
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getEmailTemplate, saveEmailTemplate, deleteEmailTemplate } from '@/lib/storage/emailTemplateStorage'
import { EmailVariableEditor } from './EmailVariableEditor'
import { EmailHtmlEditor } from './EmailHtmlEditor'

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
  const [editMode, setEditMode] = useState<'preview' | 'variables' | 'html'>('preview')
  const [editedHtml, setEditedHtml] = useState('')
  const [editedSampleData, setEditedSampleData] = useState<Record<string, string>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isCustomTemplate, setIsCustomTemplate] = useState(false)
  const [templateVariables, setTemplateVariables] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Enable/disable contentEditable on iframe when edit mode changes
  useEffect(() => {
    if (!showPreview) return

    const iframe = iframeRef.current
    if (!iframe) return

    // Wait for iframe to load content
    const enableEditing = () => {
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
    }

    // Try immediately and after a short delay (for iframe load)
    enableEditing()
    const timer = setTimeout(enableEditing, 100)

    return () => clearTimeout(timer)
  }, [isEditing, previewHtml, showPreview])

  // ESC key to exit edit mode
  useEffect(() => {
    if (!isEditing) return

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (hasUnsavedChanges) {
          const confirmed = confirm('Discard unsaved changes?')
          if (!confirmed) return
        }
        setIsEditing(false)
        setEditMode('preview')
        setHasUnsavedChanges(false)
      }
    }

    // Use capture phase to intercept before iframe gets event
    window.addEventListener('keydown', handleEscKey, true)
    return () => window.removeEventListener('keydown', handleEscKey, true)
  }, [isEditing, hasUnsavedChanges])

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
      let html: string

      // Try Firestore first (edited templates)
      const customTemplate = await getEmailTemplate(selectedTemplate)

      if (customTemplate) {
        html = customTemplate.html
        setTemplateVariables(customTemplate.variables)
        setIsCustomTemplate(true)
      } else {
        // Fallback to static file
        const basePath = process.env.NODE_ENV === 'production' ? '/reno-dev-space' : ''
        const response = await fetch(`${basePath}/email-templates/${selectedTemplate}.html`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        html = await response.text()

        // Extract variables from static file
        const vars: string[] = []
        const regex = /{{([A-Z_]+)}}/g
        let match
        while ((match = regex.exec(html)) !== null) {
          if (!vars.includes(match[1])) vars.push(match[1])
        }
        setTemplateVariables(vars)
        setIsCustomTemplate(false)
      }

      // Replace variables with sample data
      let processedHtml = html
      Object.entries(currentTemplate.sampleData).forEach(([key, value]) => {
        processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value)
      })

      setPreviewHtml(processedHtml)
      setEditedHtml(html) // Store original (with {{VARS}}) for editing
      setEditedSampleData(currentTemplate.sampleData)
      setShowPreview(true)
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('Failed to load email template')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      await saveEmailTemplate(selectedTemplate, editedHtml, user.uid)
      setIsCustomTemplate(true)
      setHasUnsavedChanges(false)
      alert('Template saved successfully!')
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = async () => {
    const confirmed = confirm(
      'Reset to default template? This will delete your custom version.'
    )
    if (!confirmed) return

    try {
      await deleteEmailTemplate(selectedTemplate)
      setIsCustomTemplate(false)
      // Reload template
      await handlePreview()
      alert('Template reset to default')
    } catch (error) {
      console.error('Failed to reset template:', error)
      alert('Failed to reset template')
    }
  }

  return (
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
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4"
          style={{
            paddingTop: '64px',     // Banner height (56px) + margin
            paddingBottom: '210px'  // Panel height (~200px) + margin
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (hasUnsavedChanges) {
                const confirmed = confirm('Discard unsaved changes?')
                if (!confirmed) return
              }
              setShowPreview(false)
              setIsEditing(false)
              setEditMode('preview')
            }
          }}
        >
          <div className="relative w-full max-w-4xl h-full bg-gray-900 rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  {currentTemplate.name}
                  {isCustomTemplate && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Custom</span>
                  )}
                </h3>
                <p className="text-xs text-gray-400">{currentTemplate.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded font-medium"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                    Edit Template
                  </button>
                ) : (
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded font-medium"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setIsEditing(false)
                    setEditMode('preview')
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body: Preview + Editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Preview (always visible) */}
              <div className={`${isEditing ? 'w-3/5' : 'w-full'} flex flex-col p-4`}>
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  className="w-full h-full border border-white/10 rounded bg-white"
                  title="Email Preview"
                />
              </div>

              {/* Right: Editor (only when editing) */}
              {isEditing && (
                <div className="w-2/5 flex flex-col">
                  {/* Editor Tabs */}
                  <div className="flex border-b border-white/10 bg-gray-800/30">
                    <button
                      onClick={() => setEditMode('variables')}
                      className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                        editMode === 'variables'
                          ? 'text-white bg-gray-800/50 border-b-2 border-indigo-400'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Variables
                    </button>
                    <button
                      onClick={() => setEditMode('html')}
                      className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                        editMode === 'html'
                          ? 'text-white bg-gray-800/50 border-b-2 border-indigo-400'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      HTML
                    </button>
                  </div>

                  {/* Editor Content */}
                  {editMode === 'variables' && (
                    <EmailVariableEditor
                      variables={templateVariables}
                      sampleData={editedSampleData}
                      onSampleDataChange={(data) => {
                        setEditedSampleData(data)
                        setHasUnsavedChanges(true)
                        // Update preview immediately
                        let updatedHtml = editedHtml
                        Object.entries(data).forEach(([key, value]) => {
                          updatedHtml = updatedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value)
                        })
                        setPreviewHtml(updatedHtml)
                      }}
                      onSave={() => {
                        // Just update preview, don't save to Firestore
                        setHasUnsavedChanges(false)
                      }}
                      onCancel={() => setIsEditing(false)}
                    />
                  )}

                  {editMode === 'html' && (
                    <EmailHtmlEditor
                      html={editedHtml}
                      onHtmlChange={(html) => {
                        setEditedHtml(html)
                        setHasUnsavedChanges(true)
                      }}
                      onSave={handleSaveTemplate}
                      onCancel={() => setIsEditing(false)}
                      isSaving={isSaving}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Footer: Reset to Default */}
            {isCustomTemplate && (
              <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-gray-400">Template has been customized</span>
                <button
                  onClick={handleResetToDefault}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline"
                >
                  Reset to Default
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
