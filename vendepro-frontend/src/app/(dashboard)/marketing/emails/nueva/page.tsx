'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import EmailCampaignWizard from '@/components/marketing/wizard/EmailCampaignWizard'

function WizardWithParams() {
  // ?id=… reabre un borrador existente en el wizard.
  const params = useSearchParams()
  const id = params.get('id') ?? undefined
  return <EmailCampaignWizard campaignId={id} />
}

export default function NewEmailCampaignPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <WizardWithParams />
    </Suspense>
  )
}
