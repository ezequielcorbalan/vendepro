'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

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

  if (reports.length <= 1) return null

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-flex items-center gap-2 hover:bg-white/30 transition-colors text-sm"
      >
        <span className="font-medium">{reports[currentIndex].period_label}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg py-1 min-w-[220px] z-50">
            {reports.map((r, i) => (
              <button
                key={r.id}
                onClick={() => {
                  setOpen(false)
                  router.push(`/r/${slug}?reporte=${i}`)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${i === currentIndex ? 'text-[#ff007c] font-medium bg-pink-50' : 'text-gray-700'}`}
              >
                {r.period_label}
                {i === reports.length - 1 && <span className="text-xs text-gray-400 ml-2">(último)</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
