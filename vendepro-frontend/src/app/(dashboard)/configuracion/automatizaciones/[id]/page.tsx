'use client'

import { use } from 'react'
import { AutomationEditor } from '../_components/AutomationEditor'

export default function EditarAutomatizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <AutomationEditor automationId={id} />
}
