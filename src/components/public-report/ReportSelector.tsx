'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, Calendar } from 'lucide-react'

interface ReportOption {
  id: string
  period_label: string
}

export default function ReportSelector({
  reports,
  currentIndex,
  slug,
}: {
  reports: ReportOption[]
  currentIndex: number
  slug: string
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const current = reports[currentIndex]

  // Single report — just show label, no dropdown
  if (reports.length <= 1) {
    return (
      <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-flex items-center gap-2 text-sm">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">Reporte: {current.period_label}</span>
      </div>
    )
  }

  // Multiple reports — dropdown selector
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-flex items-center gap-2 hover:bg-white/30 transition-colors text-sm"
      >
        <Calendar className="w-4 h-4" />
        <span className="font-medium">Reporte: {current.period_label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[240px] z-50">
            <p className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Seleccioná un reporte</p>
            {reports.map((r, i) => (
              <button
                key={r.id}
                onClick={() => {
                  setOpen(false)
                  router.push(`/r/${slug}?reporte=${i}`)
                }}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                  i === currentIndex ? 'text-[#ff007c] font-medium bg-pink-50' : 'text-gray-700'
                }`}
              >
                <span>{r.period_label}</span>
                {i === currentIndex && (
                  <span className="text-xs bg-[#ff007c] text-white px-2 py-0.5 rounded-full">actual</span>
                )}
                {i === reports.length - 1 && i !== currentIndex && (
                  <span className="text-xs text-gray-400">(último)</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
