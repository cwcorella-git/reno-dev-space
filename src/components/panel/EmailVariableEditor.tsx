'use client'

interface EmailVariableEditorProps {
  variables: string[]
  sampleData: Record<string, string>
  onSampleDataChange: (data: Record<string, string>) => void
  onSave: () => void
  onCancel: () => void
}

export function EmailVariableEditor({
  variables,
  sampleData,
  onSampleDataChange,
  onSave,
  onCancel
}: EmailVariableEditorProps) {
  return (
    <div className="flex flex-col h-full bg-gray-800/50 border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">Template Variables</h3>
        <p className="text-xs text-gray-400 mt-1">
          Edit sample values to preview changes
        </p>
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {variables.length === 0 ? (
          <p className="text-sm text-gray-400">No variables found in template</p>
        ) : (
          variables.map(varName => (
            <div key={varName}>
              <label className="block text-xs text-gray-400 mb-1.5 font-mono">
                {`{{${varName}}}`}
              </label>
              <input
                type="text"
                value={sampleData[varName] || ''}
                onChange={(e) => onSampleDataChange({
                  ...sampleData,
                  [varName]: e.target.value
                })}
                className="w-full px-3 py-2 bg-gray-700 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-indigo-400"
                placeholder={`Enter ${varName}`}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 p-4 border-t border-white/10">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
        >
          Update Preview
        </button>
      </div>
    </div>
  )
}
