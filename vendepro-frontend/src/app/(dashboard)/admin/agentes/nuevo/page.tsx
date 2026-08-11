'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'

export default function NuevoAgentePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'agent',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    try {
      const res = await apiFetch('admin', '/create-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        setSuccess(`Agente ${form.full_name} creado exitosamente. Puede ingresar con email: ${form.email}`)
        setForm({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
      } else {
        toast(data.error || 'Error al crear agente', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setLoading(false)
  }

  return (
    <div>
      <Link href="/admin/agentes" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <PageHeader title="Nuevo agente" className="mb-6" />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {success && <Alert tone="success">{success}</Alert>}

          <Field label="Nombre completo" required>
            <Input
              type="text"
              value={form.full_name}
              onChange={e => update('full_name', e.target.value)}
              required
            />
          </Field>

          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              required
            />
          </Field>

          <Field label="Teléfono">
            <Input
              type="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
            />
          </Field>

          <Field label="Contraseña inicial" required>
            <Input
              type="text"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
          </Field>

          <Field label="Rol">
            <Select value={form.role} onChange={e => update('role', e.target.value)}>
              <option value="agent">Agente</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>

          <Button type="submit" loading={loading} fullWidth>
            {loading ? 'Creando...' : 'Crear agente'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
