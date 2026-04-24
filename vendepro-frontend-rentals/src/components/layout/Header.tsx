'use client'

import { Bell, Settings } from 'lucide-react'
import Link from 'next/link'

export default function Header({ title }: { title?: string }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="text-sm font-medium text-gray-900">{title || 'VendéPro Alquileres'}</div>
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
          <Bell size={17} />
        </button>
        <Link href="/account" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
          <Settings size={17} />
        </Link>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: '#ff007c' }}>
          M
        </div>
      </div>
    </header>
  )
}
