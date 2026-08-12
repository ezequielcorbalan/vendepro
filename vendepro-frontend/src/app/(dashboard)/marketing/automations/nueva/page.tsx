'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import AutomationBuilder from '@/components/marketing/automations/AutomationBuilder'

function BuilderWithParams() {
  const params = useSearchParams()
  const id = params.get('id') ?? undefined
  return <AutomationBuilder automationId={id} />
}

export default function NewAutomationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <BuilderWithParams />
    </Suspense>
  )
}
