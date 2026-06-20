import { redirect } from 'next/navigation'
import { getCurrentUserServer } from '@/lib/auth-server'
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
  const user = await getCurrentUserServer()
  if (!user) redirect('/login')

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-brand-light">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar profile={user as unknown as Profile} />
        </div>
        {/* Mobile header */}
        <MobileHeader profile={user as unknown as Profile} />
        <main className="flex-1 min-w-0 pt-16 lg:pt-0 overflow-x-hidden">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </div>
        </main>
        <AIFloatingButton />
      </div>
    </ToastProvider>
  )
}
