import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import AIFloatingButton from '@/components/ai/AIFloatingButton'
import { ToastProvider } from '@/components/ui/Toast'
import type { Profile } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-brand-light">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar profile={user as Profile} />
        </div>
        {/* Mobile header */}
        <MobileHeader profile={user as Profile} />
        <main className="flex-1 min-w-0 lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
        <AIFloatingButton />
      </div>
    </ToastProvider>
  )
}
