'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import { ToastProvider } from '@/components/ui/Toast'
import { getCurrentUser, type CurrentUser } from '@/lib/auth'
import type { Profile } from '@/lib/types'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) {
      router.replace('/login')
      return
    }
    setUser(u)
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-[#ff007c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  // Map CurrentUser to Profile shape
  const profile: Profile = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone ?? null,
    photo_url: user.photo_url ?? null,
    role: user.role as Profile['role'],
    org_id: user.org_id,
    created_at: '',
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-50">
        <div className="hidden lg:block">
          <Sidebar profile={profile} />
        </div>
        <MobileHeader profile={profile} />
        <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
