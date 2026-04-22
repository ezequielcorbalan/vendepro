'use client'

import { useEffect, useState } from 'react'
import PublicAppraisalShell, { type PublicAppraisalData } from './PublicAppraisalShell'

interface PreviewPaneProps {
  data: PublicAppraisalData
  debounceMs?: number
}

/**
 * Live preview of the public appraisal landing, debounced to avoid re-rendering
 * on every keypress. Designed to be rendered in a sticky side column next to
 * the wizard form.
 */
export default function PreviewPane({ data, debounceMs = 300 }: PreviewPaneProps) {
  const [debounced, setDebounced] = useState(data)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(data), debounceMs)
    return () => clearTimeout(t)
  }, [data, debounceMs])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
      <div className="px-4 py-2 border-b bg-white text-xs text-gray-500 flex items-center justify-between">
        <span className="font-medium text-gray-600">Preview público</span>
        <span className="text-[10px] text-gray-400">Actualiza ~300ms</span>
      </div>
      <div className="scale-[0.92] origin-top">
        <PublicAppraisalShell data={debounced} />
      </div>
    </div>
  )
}
