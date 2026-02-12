'use client'

interface EmailHtmlEditorProps {
  html: string
  onHtmlChange: (html: string) => void
  onSave: () => Promise<void>
  onCancel: () => void
  isSaving: boolean
}

export function EmailHtmlEditor({
  html,
  onHtmlChange,
  onSave,
  onCancel,
  isSaving
}: EmailHtmlEditorProps) {
  return (
    <div className="flex flex-col h-full bg-gray-800/50 border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">HTML Source</h3>
        <p className="text-xs text-gray-400 mt-1">
          Direct HTML editing (advanced)
        </p>
      </div>

      {/* HTML Textarea */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
          className="w-full h-full font-mono text-xs bg-gray-900 text-white p-4 border border-white/20 rounded resize-none focus:outline-none focus:border-indigo-400"
          spellCheck={false}
          placeholder="Enter HTML template code..."
        />
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 p-4 border-t border-white/10">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
